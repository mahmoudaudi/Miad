import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_KEYS = ['createdAt', 'id', 'isRead', 'message', 'title', 'type'];

describe('Notifications e2e', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const emails = [`notif-a-${suffix}@example.com`, `notif-b-${suffix}@example.com`];
  const password = 'notifications-test-password-123';
  const slug = `notif-${suffix}`.toLowerCase();
  let ownerCookies: string[];
  let otherCookies: string[];
  let eventId: string;
  let invitationId: string;

  const withCookies = (test: request.Test, cookies: string[]) => test.set('Cookie', cookies);

  const list = (server: ReturnType<typeof app.getHttpServer>, cookies: string[], query = '') =>
    withCookies(request(server).get(`/api/v1/notifications${query}`), cookies);

  const rsvp = (
    server: ReturnType<typeof app.getHttpServer>,
    guest: { name: string; email?: string; phone?: string },
    status: 'ATTENDING' | 'NOT_ATTENDING' | 'PENDING' = 'ATTENDING',
    attendeesCount = 1
  ) =>
    request(server)
      .post(`/api/v1/public/invitations/${slug}/rsvp`)
      .send({ name: guest.name, status, attendeesCount, ...guest });

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
      .send({ firstName: 'Notif', lastName: 'Owner', email: emails[0], password })
      .expect(201);
    const other = await request(server)
      .post('/api/v1/auth/register')
      .send({ firstName: 'Other', lastName: 'Owner', email: emails[1], password })
      .expect(201);
    ownerCookies = owner.headers['set-cookie'] as unknown as string[];
    otherCookies = other.headers['set-cookie'] as unknown as string[];
    eventId = (
      await withCookies(request(server).post('/api/v1/events'), ownerCookies)
        .send({ title: 'Notification Night', eventType: 'Dinner', eventDate: '2026-12-04' })
        .expect(201)
    ).body.id;
    invitationId = (
      await withCookies(request(server).post('/api/v1/invitations'), ownerCookies)
        .send({ eventId, slug })
        .expect(201)
    ).body.id;
    await withCookies(
      request(server).post(`/api/v1/invitations/${invitationId}/design`),
      ownerCookies
    )
      .send({ theme: 'classic-ivory' })
      .expect(201);
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
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    await prisma.$disconnect();
    await app?.close();
  });

  it('requires authentication on every notifications endpoint', async () => {
    const server = app.getHttpServer();
    await request(server).get('/api/v1/notifications').expect(401);
    await request(server).patch('/api/v1/notifications/read-all').expect(401);
    await request(server)
      .patch('/api/v1/notifications/33333333-3333-4333-8333-333333333333/read')
      .expect(401);
  });

  it('validates cursors, limits, route IDs, and forbids client-supplied fields', async () => {
    const server = app.getHttpServer();
    await list(server, ownerCookies, '?cursor=bogus').expect(400);
    await list(server, ownerCookies, '?cursor=not-a-uuid').expect(400);
    await list(server, ownerCookies, '?limit=0').expect(400);
    await list(server, ownerCookies, '?limit=51').expect(400);
    await list(server, ownerCookies, '?limit=50').expect(200);
    await withCookies(request(server).get('/api/v1/notifications'), ownerCookies)
      .query({ userId: 'evil' })
      .expect(400);
    await withCookies(request(server).patch('/api/v1/notifications/read-all'), ownerCookies)
      .send({ userId: 'evil', isRead: false, title: 'forged' })
      .expect(400);
    await withCookies(
      request(server).patch('/api/v1/notifications/not-a-uuid/read'),
      ownerCookies
    ).expect(400);
    await withCookies(
      request(server).patch('/api/v1/notifications/33333333-3333-4333-8333-333333333333/read'),
      ownerCookies
    ).send({ type: 'ADMIN_ALERT' })
      .expect(400);
  });

  it('starts with an empty owner-scoped list', async () => {
    const server = app.getHttpServer();
    const empty = await list(server, ownerCookies).expect(200);
    expect(empty.body).toEqual({ items: [], nextCursor: null });
    const otherEmpty = await list(server, otherCookies).expect(200);
    expect(otherEmpty.body).toEqual({ items: [], nextCursor: null });
  });

  it('creates no notification for draft, invalid, or duplicate RSVPs (atomic failure paths)', async () => {
    const server = app.getHttpServer();
    // Draft invitation → 404, no notification.
    await rsvp(server, { name: 'Draft Guest', email: `draft-${suffix}@example.com` }).expect(404);
    let page = await list(server, ownerCookies).expect(200);
    expect(page.body.items).toHaveLength(0);

    await withCookies(
      request(server).patch(`/api/v1/invitations/${invitationId}/publication`),
      ownerCookies
    )
      .send({ published: true })
      .expect(200);

    // Invalid payload → 400, no notification.
    await request(server)
      .post(`/api/v1/public/invitations/${slug}/rsvp`)
      .send({ name: '', status: 'ATTENDING', attendeesCount: 1 })
      .expect(400);
    page = await list(server, ownerCookies).expect(200);
    expect(page.body.items).toHaveLength(0);
  });

  it('creates exactly one server-composed notification for the event owner on a valid public RSVP', async () => {
    const server = app.getHttpServer();
    const payload = {
      name: 'Nadia Notified',
      email: `nadia-${suffix}@example.com`,
      status: 'ATTENDING',
      attendeesCount: 2,
      message: 'See you there.',
    };
    await rsvp(server, payload, 'ATTENDING', 2).expect(201).expect({ status: 'received' });

    const page = await list(server, ownerCookies).expect(200);
    expect(page.body.items).toHaveLength(1);
    const item = page.body.items[0];
    expect(Object.keys(item).sort()).toEqual([...SAFE_KEYS].sort());
    expect(item).toMatchObject({
      type: 'RSVP_RECEIVED',
      title: 'New attendance confirmation from Nadia Notified',
      message: 'Nadia Notified responded: Attending.',
      isRead: false,
    });
    expect(UUID_PATTERN.test(item.id)).toBe(true);

    // Another user sees none of the owner's notifications.
    const otherPage = await list(server, otherCookies).expect(200);
    expect(otherPage.body.items).toHaveLength(0);

    // Duplicate contact → 409, still exactly one notification.
    await rsvp(server, payload, 'ATTENDING', 2).expect(409);
    const afterDuplicate = await list(server, ownerCookies).expect(200);
    expect(afterDuplicate.body.items).toHaveLength(1);
  });

  it('marks one notification read idempotently and refuses cross-user access with a safe 404', async () => {
    const server = app.getHttpServer();
    const before = await list(server, ownerCookies).expect(200);
    const target = before.body.items[0];
    expect(target.isRead).toBe(false);

    await withCookies(
      request(server).patch(`/api/v1/notifications/${target.id}/read`),
      otherCookies
    ).expect(404);

    const read = await withCookies(
      request(server).patch(`/api/v1/notifications/${target.id}/read`),
      ownerCookies
    ).expect(200);
    expect(read.body).toMatchObject({ id: target.id, isRead: true });
    expect(Object.keys(read.body).sort()).toEqual([...SAFE_KEYS].sort());

    const retried = await withCookies(
      request(server).patch(`/api/v1/notifications/${target.id}/read`),
      ownerCookies
    ).expect(200);
    expect(retried.body.isRead).toBe(true);

    // Missing notification → same safe 404.
    await withCookies(
      request(server).patch('/api/v1/notifications/99999999-9999-4999-8999-999999999999/read'),
      ownerCookies
    ).expect(404);

    // Persisted across requests.
    const persisted = await list(server, ownerCookies).expect(200);
    expect(persisted.body.items[0]).toMatchObject({ id: target.id, isRead: true });
  });

  it('keeps pagination stable and marks all remaining notifications read', async () => {
    const server = app.getHttpServer();
    // Add two more valid RSVPs (different contacts) for pagination + mark-all.
    await rsvp(server, { name: 'Omar Page', email: `omar-${suffix}@example.com` }).expect(201);
    await rsvp(server, { name: 'Lea Page', phone: `+96170${suffix.slice(0, 6)}` }).expect(201);

    const first = await list(server, ownerCookies, '?limit=1').expect(200);
    expect(first.body.items).toHaveLength(1);
    expect(first.body.nextCursor).toBeTruthy();
    expect(first.body.items[0].isRead).toBe(false); // Newest first — an unread RSVP.

    const second = await list(server, ownerCookies, `?cursor=${first.body.nextCursor}&limit=1`).expect(200);
    expect(second.body.items).toHaveLength(1);
    expect(second.body.items[0].id).not.toBe(first.body.items[0].id);
    expect(second.body.nextCursor).toBeTruthy();

    const third = await list(server, ownerCookies, `?cursor=${second.body.nextCursor}&limit=1`).expect(200);
    expect(third.body.items).toHaveLength(1);
    expect(third.body.nextCursor).toBeNull();

    const pagedIds = [
      first.body.items[0].id,
      second.body.items[0].id,
      third.body.items[0].id,
    ];
    expect(new Set(pagedIds).size).toBe(3); // Stable pages, no overlap.
    const pagedRows = [first.body.items[0], second.body.items[0], third.body.items[0]];
    expect(pagedRows.filter((row: { isRead: boolean }) => row.isRead)).toHaveLength(1); // Nadia's, already read.

    const otherMarkAll = await withCookies(
      request(server).patch('/api/v1/notifications/read-all'),
      otherCookies
    ).expect(200);
    expect(otherMarkAll.body).toEqual({ updated: 0 });

    const markAll = await withCookies(
      request(server).patch('/api/v1/notifications/read-all'),
      ownerCookies
    ).expect(200);
    expect(markAll.body).toEqual({ updated: 2 });

    const finalPage = await list(server, ownerCookies).expect(200);
    expect(finalPage.body.items).toHaveLength(3);
    expect(finalPage.body.items.every((row: { isRead: boolean }) => row.isRead)).toBe(true);

    // Idempotent: nothing unread left.
    const again = await withCookies(
      request(server).patch('/api/v1/notifications/read-all'),
      ownerCookies
    ).expect(200);
    expect(again.body).toEqual({ updated: 0 });

    // The other user still sees nothing.
    const untouched = await list(server, otherCookies).expect(200);
    expect(untouched.body.items).toHaveLength(0);
  });
});
