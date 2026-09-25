import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Invitations e2e', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const emails = [`invites-a-${suffix}@example.com`, `invites-b-${suffix}@example.com`];
  const password = 'invitations-test-password-123';
  let ownerCookies: string[];
  let otherCookies: string[];
  let ownerEventId: string;
  let otherEventId: string;
  let invitationId: string;

  const withCookies = (test: request.Test, cookies: string[]) => test.set('Cookie', cookies);
  const eventInput = (title: string) => ({
    title,
    eventType: 'Dinner',
    eventDate: '2026-11-14',
  });

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
      .send({ firstName: 'Invitation', lastName: 'Owner', email: emails[0], password })
      .expect(201);
    const other = await request(server)
      .post('/api/v1/auth/register')
      .send({ firstName: 'Other', lastName: 'User', email: emails[1], password })
      .expect(201);
    ownerCookies = owner.headers['set-cookie'] as unknown as string[];
    otherCookies = other.headers['set-cookie'] as unknown as string[];
    ownerEventId = (
      await withCookies(request(server).post('/api/v1/events'), ownerCookies)
        .send(eventInput('Owner Event'))
        .expect(201)
    ).body.id;
    otherEventId = (
      await withCookies(request(server).post('/api/v1/events'), otherCookies)
        .send(eventInput('Other Event'))
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    const ids = users.map((user) => user.id);
    if (ids.length > 0) {
      await prisma.invitation.deleteMany({ where: { event: { userId: { in: ids } } } });
      await prisma.event.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.$disconnect();
    await app?.close();
  });

  it('rejects unauthenticated, invalid, and cross-owner creation', async () => {
    const server = app.getHttpServer();
    await request(server).get('/api/v1/invitations').expect(401);
    await withCookies(request(server).post('/api/v1/invitations'), ownerCookies)
      .send({ eventId: ownerEventId, slug: 'Invalid Slug', status: 'PUBLISHED' })
      .expect(400);
    await withCookies(request(server).post('/api/v1/invitations'), ownerCookies)
      .send({ eventId: otherEventId, slug: 'other-event' })
      .expect(404);
  });

  it('creates one draft invitation and lists only owned records', async () => {
    const server = app.getHttpServer();
    const created = await withCookies(request(server).post('/api/v1/invitations'), ownerCookies)
      .send({ eventId: ownerEventId, slug: '  Owner-Garden  ' })
      .expect(201);
    invitationId = created.body.id;
    expect(created.body).toMatchObject({
      eventId: ownerEventId,
      slug: 'owner-garden',
      status: 'DRAFT',
      publishedAt: null,
    });

    await withCookies(request(server).post('/api/v1/invitations'), ownerCookies)
      .send({ eventId: ownerEventId, slug: 'second-invitation' })
      .expect(409);

    const ownerList = await withCookies(
      request(server).get(`/api/v1/invitations?eventId=${ownerEventId}`),
      ownerCookies
    ).expect(200);
    const otherList = await withCookies(
      request(server).get(`/api/v1/invitations?eventId=${ownerEventId}`),
      otherCookies
    ).expect(200);
    expect(ownerList.body).toHaveLength(1);
    expect(otherList.body).toHaveLength(0);
  });

  it('blocks cross-user read, update, and delete', async () => {
    const server = app.getHttpServer();
    await withCookies(
      request(server).get(`/api/v1/invitations/${invitationId}`),
      otherCookies
    ).expect(404);
    await withCookies(request(server).patch(`/api/v1/invitations/${invitationId}`), otherCookies)
      .send({ slug: 'stolen-slug' })
      .expect(404);
    await withCookies(
      request(server).delete(`/api/v1/invitations/${invitationId}`),
      otherCookies
    ).expect(404);
  });

  it('gets, updates, and deletes the owned invitation', async () => {
    const server = app.getHttpServer();
    await withCookies(request(server).get(`/api/v1/invitations/${invitationId}`), ownerCookies)
      .expect(200)
      .expect((response) => expect(response.body.event.title).toBe('Owner Event'));
    await withCookies(request(server).patch(`/api/v1/invitations/${invitationId}`), ownerCookies)
      .send({ slug: 'updated-garden' })
      .expect(200)
      .expect((response) => expect(response.body.slug).toBe('updated-garden'));
    await withCookies(
      request(server).delete(`/api/v1/invitations/${invitationId}`),
      ownerCookies
    ).expect(204);
    await withCookies(
      request(server).get(`/api/v1/invitations/${invitationId}`),
      ownerCookies
    ).expect(404);
  });
});
