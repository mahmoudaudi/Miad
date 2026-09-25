import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Events e2e', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const emails = [`events-a-${suffix}@example.com`, `events-b-${suffix}@example.com`];
  const password = 'events-test-password-123';
  let ownerCookies: string[];
  let otherCookies: string[];
  let eventId: string;

  const withCookies = (test: request.Test, cookies: string[]) => test.set('Cookie', cookies);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix(process.env.API_PREFIX ?? 'api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    const server = app.getHttpServer();
    const owner = await request(server)
      .post('/api/v1/auth/register')
      .send({ firstName: 'Event', lastName: 'Owner', email: emails[0], password })
      .expect(201);
    const other = await request(server)
      .post('/api/v1/auth/register')
      .send({ firstName: 'Other', lastName: 'User', email: emails[1], password })
      .expect(201);
    ownerCookies = owner.headers['set-cookie'] as unknown as string[];
    otherCookies = other.headers['set-cookie'] as unknown as string[];
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    const ids = users.map((user) => user.id);
    if (ids.length > 0) {
      await prisma.event.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.$disconnect();
    await app?.close();
  });

  it('rejects unauthenticated and invalid event requests', async () => {
    const server = app.getHttpServer();
    await request(server).get('/api/v1/events').expect(401);
    await withCookies(request(server).post('/api/v1/events'), ownerCookies)
      .send({ title: ' ', eventType: 'Dinner', eventDate: '2026-02-30', userId: 'spoofed' })
      .expect(400);
  });

  it('creates and lists only the authenticated user events', async () => {
    const server = app.getHttpServer();
    const created = await withCookies(request(server).post('/api/v1/events'), ownerCookies)
      .send({
        title: '  Garden Dinner  ',
        eventType: ' Dinner ',
        description: 'An evening outside.',
        eventDate: '2026-10-12',
        startTime: '18:30',
        venueName: 'The Garden',
        latitude: 33.8938,
        longitude: 35.5018,
      })
      .expect(201);
    eventId = created.body.id;
    expect(created.body).toMatchObject({
      title: 'Garden Dinner',
      eventType: 'Dinner',
      eventDate: '2026-10-12',
      startTime: '18:30',
    });
    expect(created.body.userId).toBeUndefined();

    const ownerList = await withCookies(request(server).get('/api/v1/events'), ownerCookies).expect(
      200
    );
    const otherList = await withCookies(request(server).get('/api/v1/events'), otherCookies).expect(
      200
    );
    expect(ownerList.body).toHaveLength(1);
    expect(otherList.body).toHaveLength(0);
  });

  it('does not reveal, update, or delete another user event', async () => {
    const server = app.getHttpServer();
    await withCookies(request(server).get(`/api/v1/events/${eventId}`), otherCookies).expect(404);
    await withCookies(request(server).patch(`/api/v1/events/${eventId}`), otherCookies)
      .send({ title: 'Stolen' })
      .expect(404);
    await withCookies(request(server).delete(`/api/v1/events/${eventId}`), otherCookies).expect(
      404
    );
  });

  it('gets, updates, and deletes the owner event', async () => {
    const server = app.getHttpServer();
    await withCookies(request(server).get(`/api/v1/events/${eventId}`), ownerCookies)
      .expect(200)
      .expect((response) => expect(response.body.title).toBe('Garden Dinner'));
    await withCookies(request(server).patch(`/api/v1/events/${eventId}`), ownerCookies)
      .send({ title: 'Autumn Garden Dinner', venueName: null })
      .expect(200)
      .expect((response) => expect(response.body.title).toBe('Autumn Garden Dinner'));
    await withCookies(request(server).delete(`/api/v1/events/${eventId}`), ownerCookies).expect(
      204
    );
    await withCookies(request(server).get(`/api/v1/events/${eventId}`), ownerCookies).expect(404);
  });
});
