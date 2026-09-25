import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { MAX_MEDIA_FILE_BYTES } from '../src/media/media-validation';

const hasStorage = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);
const JPEG_BYTES = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==',
  'base64'
);
const GIF_BYTES = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

describe('Invitation media e2e', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const emails = [`media-a-${suffix}@example.com`, `media-b-${suffix}@example.com`];
  const password = 'media-test-password-123';
  const slug = `media-${suffix}`.toLowerCase();
  let ownerCookies: string[];
  let otherCookies: string[];
  let eventId: string;
  let invitationId: string;

  const withCookies = (test: request.Test, cookies: string[]) => test.set('Cookie', cookies);

  const uploadPng = async (
    server: ReturnType<typeof app.getHttpServer>,
    cookies: string[],
    fileName = 'pixel.png'
  ): Promise<{ id: string; body: Record<string, unknown> }> => {
    const target = await withCookies(
      request(server).post(`/api/v1/invitations/${invitationId}/media/uploads`),
      cookies
    )
      .send({ fileName, fileType: 'image/png', fileSize: PNG_BYTES.length })
      .expect(201);
    await request.put(target.body.uploadUrl as string)
      .set('Content-Type', 'image/png')
      .send(PNG_BYTES)
      .expect(200);
    const completed = await withCookies(
      request(server).post(
        `/api/v1/invitations/${invitationId}/media/${target.body.mediaId}/complete`
      ),
      cookies
    )
      .send({ fileName, fileType: 'image/png', fileSize: PNG_BYTES.length })
      .expect(201);
    return { id: target.body.mediaId as string, body: completed.body };
  };

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
      .send({ firstName: 'Media', lastName: 'Owner', email: emails[0], password })
      .expect(201);
    const other = await request(server)
      .post('/api/v1/auth/register')
      .send({ firstName: 'Other', lastName: 'Owner', email: emails[1], password })
      .expect(201);
    ownerCookies = owner.headers['set-cookie'] as unknown as string[];
    otherCookies = other.headers['set-cookie'] as unknown as string[];
    eventId = (
      await withCookies(request(server).post('/api/v1/events'), ownerCookies)
        .send({ title: 'Media Dinner', eventType: 'Dinner', eventDate: '2026-12-02' })
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
      await prisma.mediaAsset.deleteMany({
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

  it('requires authentication on every media endpoint', async () => {
    const server = app.getHttpServer();
    await request(server).get(`/api/v1/invitations/${invitationId}/media`).expect(401);
    await request(server)
      .post(`/api/v1/invitations/${invitationId}/media/uploads`)
      .send({ fileName: 'a.png', fileType: 'image/png', fileSize: 10 })
      .expect(401);
    await request(server)
      .post(
        `/api/v1/invitations/${invitationId}/media/33333333-3333-4333-8333-333333333333/complete`
      )
      .send({ fileName: 'a.png', fileType: 'image/png', fileSize: 10 })
      .expect(401);
    await request(server)
      .delete(
        `/api/v1/invitations/${invitationId}/media/33333333-3333-4333-8333-333333333333`
      )
      .expect(401);
  });

  it('validates upload metadata, cursors, and forbids unknown fields', async () => {
    const server = app.getHttpServer();
    await withCookies(
      request(server).post(`/api/v1/invitations/${invitationId}/media/uploads`),
      ownerCookies
    )
      .send({ fileName: 'evil.svg', fileType: 'image/svg+xml', fileSize: 10 })
      .expect(400);
    await withCookies(
      request(server).post(`/api/v1/invitations/${invitationId}/media/uploads`),
      ownerCookies
    )
      .send({ fileName: 'big.png', fileType: 'image/png', fileSize: MAX_MEDIA_FILE_BYTES + 1 })
      .expect(400);
    await withCookies(
      request(server).post(`/api/v1/invitations/${invitationId}/media/uploads`),
      ownerCookies
    )
      .send({ fileName: 'a.png', fileType: 'image/png', fileSize: 10, objectPath: 'evil' })
      .expect(400);
    await withCookies(
      request(server).get(`/api/v1/invitations/${invitationId}/media?cursor=bogus`),
      ownerCookies
    ).expect(400);
    await withCookies(
      request(server).get(`/api/v1/invitations/${invitationId}/media?limit=999`),
      ownerCookies
    ).expect(400);
  });

  it('protects invitation ownership with safe 404s for cross-user and missing invitations', async () => {
    const server = app.getHttpServer();
    const missing = '99999999-9999-4999-8999-999999999999';
    await withCookies(request(server).get(`/api/v1/invitations/${invitationId}/media`), otherCookies).expect(
      404
    );
    await withCookies(
      request(server).post(`/api/v1/invitations/${invitationId}/media/uploads`),
      otherCookies
    )
      .send({ fileName: 'a.png', fileType: 'image/png', fileSize: 10 })
      .expect(404);
    await withCookies(
      request(server).post(
        `/api/v1/invitations/${invitationId}/media/33333333-3333-4333-8333-333333333333/complete`
      ),
      otherCookies
    )
      .send({ fileName: 'a.png', fileType: 'image/png', fileSize: 10 })
      .expect(404);
    await withCookies(
      request(server).delete(
        `/api/v1/invitations/${invitationId}/media/33333333-3333-4333-8333-333333333333`
      ),
      otherCookies
    ).expect(404);
    await withCookies(request(server).get(`/api/v1/invitations/${missing}/media`), ownerCookies).expect(
      404
    );
    await withCookies(request(server).post(`/api/v1/invitations/${missing}/media/uploads`), ownerCookies)
      .send({ fileName: 'a.png', fileType: 'image/png', fileSize: 10 })
      .expect(404);
  });

  it('lists an empty page for the draft invitation before any uploads', async () => {
    const server = app.getHttpServer();
    const list = await withCookies(
      request(server).get(`/api/v1/invitations/${invitationId}/media`),
      ownerCookies
    ).expect(200);
    expect(list.body).toEqual({ items: [], nextCursor: null });
  });

  (hasStorage ? it : it.skip)(
    'signed upload → complete → idempotent retry → list/preview → delete on a draft invitation',
    async () => {
      const server = app.getHttpServer();
      const uploaded = await uploadPng(server, ownerCookies);
      expect(uploaded.body).toMatchObject({
        id: uploaded.id,
        fileName: 'pixel.png',
        fileType: 'image/png',
        fileSize: PNG_BYTES.length,
      });
      expect(uploaded.body.previewUrl).toContain('http');

      // Idempotent completion retry returns the same persisted asset.
      const retried = await withCookies(
        request(server).post(
          `/api/v1/invitations/${invitationId}/media/${uploaded.id}/complete`
        ),
        ownerCookies
      )
        .send({ fileName: 'pixel.png', fileType: 'image/png', fileSize: PNG_BYTES.length })
        .expect(201);
      expect(retried.body.id).toBe(uploaded.id);

      const list = await withCookies(
        request(server).get(`/api/v1/invitations/${invitationId}/media`),
        ownerCookies
      ).expect(200);
      expect(list.body.items).toHaveLength(1);
      expect(list.body.items[0]).toMatchObject({ id: uploaded.id, fileName: 'pixel.png' });
      expect(list.body.items[0].previewUrl).toContain('http');
      expect(list.body.nextCursor).toBeNull();

      await withCookies(
        request(server).delete(`/api/v1/invitations/${invitationId}/media/${uploaded.id}`),
        ownerCookies
      ).expect(204);
      const afterDelete = await withCookies(
        request(server).get(`/api/v1/invitations/${invitationId}/media`),
        ownerCookies
      ).expect(200);
      expect(afterDelete.body.items).toHaveLength(0);
      // Retry-safe: deleting again is a safe 404 for the row, not a server error.
      await withCookies(
        request(server).delete(`/api/v1/invitations/${invitationId}/media/${uploaded.id}`),
        ownerCookies
      ).expect(404);
    }
  );

  (hasStorage ? it : it.skip)(
    'rejects disallowed signatures and oversized/mismatched uploads, cleaning temporary objects',
    async () => {
      const server = app.getHttpServer();

      // GIF bytes declared as PNG — signature check fails and the object is removed.
      const target = await withCookies(
        request(server).post(`/api/v1/invitations/${invitationId}/media/uploads`),
        ownerCookies
      )
        .send({ fileName: 'fake.png', fileType: 'image/png', fileSize: GIF_BYTES.length })
        .expect(201);
      await request.put(target.body.uploadUrl as string)
        .set('Content-Type', 'image/png')
        .send(GIF_BYTES)
        .expect(200);
      await withCookies(
        request(server).post(
          `/api/v1/invitations/${invitationId}/media/${target.body.mediaId}/complete`
        ),
        ownerCookies
      )
        .send({ fileName: 'fake.png', fileType: 'image/png', fileSize: GIF_BYTES.length })
        .expect(400);
      // The rejected object was cleaned up — a corrected retry finds nothing.
      await withCookies(
        request(server).post(
          `/api/v1/invitations/${invitationId}/media/${target.body.mediaId}/complete`
        ),
        ownerCookies
      )
        .send({ fileName: 'fake.png', fileType: 'image/png', fileSize: GIF_BYTES.length })
        .expect(400);

      // Declared size mismatch is rejected and cleaned up too.
      const jpegTarget = await withCookies(
        request(server).post(`/api/v1/invitations/${invitationId}/media/uploads`),
        ownerCookies
      )
        .send({ fileName: 'photo.jpg', fileType: 'image/jpeg', fileSize: JPEG_BYTES.length })
        .expect(201);
      await request.put(jpegTarget.body.uploadUrl as string)
        .set('Content-Type', 'image/jpeg')
        .send(JPEG_BYTES)
        .expect(200);
      await withCookies(
        request(server).post(
          `/api/v1/invitations/${invitationId}/media/${jpegTarget.body.mediaId}/complete`
        ),
        ownerCookies
      )
        .send({ fileName: 'photo.jpg', fileType: 'image/jpeg', fileSize: JPEG_BYTES.length + 5 })
        .expect(400);

      const list = await withCookies(
        request(server).get(`/api/v1/invitations/${invitationId}/media`),
        ownerCookies
      ).expect(200);
      expect(list.body.items).toHaveLength(0);
    }
  );

  (hasStorage ? it : it.skip)(
    'rejects completing an upload when no object was ever uploaded',
    async () => {
      const server = app.getHttpServer();
      const target = await withCookies(
        request(server).post(`/api/v1/invitations/${invitationId}/media/uploads`),
        ownerCookies
      )
        .send({ fileName: 'never.png', fileType: 'image/png', fileSize: 64 })
        .expect(201);
      await withCookies(
        request(server).post(
          `/api/v1/invitations/${invitationId}/media/${target.body.mediaId}/complete`
        ),
        ownerCookies
      )
        .send({ fileName: 'never.png', fileType: 'image/png', fileSize: 64 })
        .expect(400);
    }
  );
});
