import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Guests and RSVP e2e', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const emails = [`guests-a-${suffix}@example.com`, `guests-b-${suffix}@example.com`];
  const password = 'guests-rsvp-test-password-123';
  const slug = `guests-${suffix}`.toLowerCase();
  let ownerCookies: string[];
  let otherCookies: string[];
  let eventId: string;
  let invitationId: string;
  let guestId: string;

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
      .send({ firstName: 'Guest', lastName: 'Owner', email: emails[0], password })
      .expect(201);
    const other = await request(server)
      .post('/api/v1/auth/register')
      .send({ firstName: 'Other', lastName: 'Owner', email: emails[1], password })
      .expect(201);
    ownerCookies = owner.headers['set-cookie'] as unknown as string[];
    otherCookies = other.headers['set-cookie'] as unknown as string[];
    eventId = (
      await withCookies(request(server).post('/api/v1/events'), ownerCookies)
        .send({ title: 'RSVP Dinner', eventType: 'Dinner', eventDate: '2026-12-01' })
        .expect(201)
    ).body.id;
    invitationId = (
      await withCookies(request(server).post('/api/v1/invitations'), ownerCookies)
        .send({ eventId, slug })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);
    if (userIds.length) {
      await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.rsvp.deleteMany({
        where: { guest: { invitation: { event: { userId: { in: userIds } } } } },
      });
      await prisma.guest.deleteMany({
        where: { invitation: { event: { userId: { in: userIds } } } },
      });
      await prisma.invitationDesign.deleteMany({
        where: { invitation: { event: { userId: { in: userIds } } } },
      });
      await prisma.invitation.deleteMany({ where: { event: { userId: { in: userIds } } } });
      await prisma.event.deleteMany({ where: { userId: { in: userIds } } });
      // Registration grants credits in an immutable ledger. Keep the uniquely
      // named test users and their financial history rather than bypassing the
      // production append-only trigger during suite cleanup.
    }
    await prisma.$disconnect();
    await app?.close();
  });

  it('requires authentication, validates input, and protects event ownership', async () => {
    const server = app.getHttpServer();
    await request(server).get(`/api/v1/events/${eventId}/guests`).expect(401);
    await withCookies(request(server).post(`/api/v1/events/${eventId}/guests`), ownerCookies)
      .send({ name: '', email: 'invalid', extra: true })
      .expect(400);
    await withCookies(request(server).get(`/api/v1/events/${eventId}/guests`), otherCookies).expect(
      404
    );
  });

  it('creates, lists, reads, and updates an owned guest', async () => {
    const server = app.getHttpServer();
    const created = await withCookies(
      request(server).post(`/api/v1/events/${eventId}/guests`),
      ownerCookies
    )
      .send({ name: ' Nadia ', email: ' NADIA.RSVP@example.com ' })
      .expect(201);
    guestId = created.body.id;
    expect(created.body).toMatchObject({
      name: 'Nadia',
      email: 'nadia.rsvp@example.com',
      rsvp: { status: 'PENDING', attendeesCount: 0, respondedAt: null },
    });
    const list = await withCookies(
      request(server).get(`/api/v1/events/${eventId}/guests`),
      ownerCookies
    ).expect(200);
    expect(list.body).toHaveLength(1);
    await withCookies(
      request(server).get(`/api/v1/events/${eventId}/guests/${guestId}`),
      ownerCookies
    ).expect(200);
    await withCookies(
      request(server).patch(`/api/v1/events/${eventId}/guests/${guestId}`),
      ownerCookies
    )
      .send({ phone: '+961 70 000 000', status: 'ATTENDING', partySize: 3, notes: 'Vegetarian' })
      .expect(200)
      .expect((response) => {
        expect(response.body.phone).toBe('+961 70 000 000');
        expect(response.body.rsvp).toMatchObject({
          status: 'ATTENDING',
          attendeesCount: 3,
          message: 'Vegetarian',
        });
      });
  });

  it('returns safe 404 responses for cross-user guest access', async () => {
    const server = app.getHttpServer();
    await withCookies(
      request(server).get(`/api/v1/invitations/${invitationId}/guests`),
      otherCookies
    ).expect(404);
    await withCookies(
      request(server).get(`/api/v1/events/${eventId}/guests/${guestId}`),
      otherCookies
    ).expect(404);
    await withCookies(
      request(server).patch(`/api/v1/events/${eventId}/guests/${guestId}`),
      otherCookies
    )
      .send({ name: 'Stolen' })
      .expect(404);
    await withCookies(
      request(server).delete(`/api/v1/events/${eventId}/guests/${guestId}`),
      otherCookies
    ).expect(404);
  });

  it('accepts RSVP only for a published invitation and shows it to the owner', async () => {
    const server = app.getHttpServer();
    const payload = {
      name: 'Nadia',
      status: 'ATTENDING',
      attendeesCount: 2,
      message: 'Looking forward to it.',
    };
    await request(server).post(`/api/v1/public/invitations/${slug}/rsvp`).send(payload).expect(404);
    await withCookies(
      request(server).post(`/api/v1/invitations/${invitationId}/design`),
      ownerCookies
    )
      .send({ theme: 'classic-ivory' })
      .expect(201);
    await withCookies(
      request(server).patch(`/api/v1/invitations/${invitationId}/publication`),
      ownerCookies
    )
      .send({ published: true })
      .expect(200);
    await request(server)
      .post(`/api/v1/public/invitations/${slug}/rsvp`)
      .send({ ...payload, guestId })
      .expect(400);
    await request(server)
      .post(`/api/v1/public/invitations/${slug}/rsvp`)
      .send(payload)
      .expect(201)
      .expect({ status: 'received' });
    await request(server)
      .get(`/api/v1/public/invitations/${slug}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).not.toHaveProperty('guests');
        expect(JSON.stringify(response.body)).not.toContain('Nadia');
      });
    const list = await withCookies(
      request(server).get(`/api/v1/events/${eventId}/guests`),
      ownerCookies
    ).expect(200);
    expect(list.body[0].rsvp).toMatchObject({
      status: 'ATTENDING',
      attendeesCount: 2,
      message: 'Looking forward to it.',
    });
    await request(server)
      .post(`/api/v1/public/invitations/${slug}/rsvp`)
      .send({ ...payload, attendeesCount: 3, message: 'Updated party size.' })
      .expect(201);
    const updatedList = await withCookies(
      request(server).get(`/api/v1/invitations/${invitationId}/guests`),
      ownerCookies
    ).expect(200);
    expect(updatedList.body).toHaveLength(1);
    expect(updatedList.body[0].rsvp).toMatchObject({
      status: 'ATTENDING',
      attendeesCount: 3,
      message: 'Updated party size.',
      respondedAt: expect.any(String),
    });
    await request(server).get(`/api/v1/invitations/${invitationId}/guests`).expect(401);
  });

  it('validates public RSVP semantics and deletes a guest with its RSVP', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post(`/api/v1/public/invitations/${slug}/rsvp`)
      .send({ name: 'Pending Guest', status: 'PENDING' })
      .expect(400);
    await request(server)
      .post(`/api/v1/public/invitations/${slug}/rsvp`)
      .send({ name: 'Extra Field', status: 'NOT_ATTENDING', email: 'extra@example.com' })
      .expect(400);
    await request(server)
      .post(`/api/v1/public/invitations/${slug}/rsvp`)
      .send({ name: 'Declining', status: 'NOT_ATTENDING', attendeesCount: 1 })
      .expect(400);
    await withCookies(
      request(server).delete(`/api/v1/events/${eventId}/guests/${guestId}`),
      ownerCookies
    ).expect(204);
    await withCookies(
      request(server).get(`/api/v1/events/${eventId}/guests/${guestId}`),
      ownerCookies
    ).expect(404);
  });
});
