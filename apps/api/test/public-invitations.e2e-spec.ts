import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Public invitations e2e', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const emails = [`public-a-${suffix}@example.com`, `public-b-${suffix}@example.com`];
  const password = 'public-invitation-test-password-123';
  const ownerSlug = `public-owner-${suffix}`;
  let ownerCookies: string[];
  let otherCookies: string[];
  let ownerInvitationId: string;

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
      .send({ firstName: 'Public', lastName: 'Owner', email: emails[0], password })
      .expect(201);
    const other = await request(server)
      .post('/api/v1/auth/register')
      .send({ firstName: 'Other', lastName: 'Owner', email: emails[1], password })
      .expect(201);
    ownerCookies = owner.headers['set-cookie'] as unknown as string[];
    otherCookies = other.headers['set-cookie'] as unknown as string[];

    const event = await withCookies(request(server).post('/api/v1/events'), ownerCookies)
      .send({
        title: 'Published Garden Evening',
        eventType: 'Celebration',
        eventDate: '2027-05-22',
        venueName: 'The Garden Room',
      })
      .expect(201);
    const invitation = await withCookies(request(server).post('/api/v1/invitations'), ownerCookies)
      .send({ eventId: event.body.id, slug: ownerSlug })
      .expect(201);
    ownerInvitationId = invitation.body.id;
    await withCookies(
      request(server).post(`/api/v1/invitations/${ownerInvitationId}/design`),
      ownerCookies
    )
      .send({ theme: 'modern-contrast' })
      .expect(201);
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    const userIds = users.map((user) => user.id);
    if (userIds.length > 0) {
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

  it('hides draft, invalid, and nonexistent slugs from unauthenticated visitors', async () => {
    const server = app.getHttpServer();
    await request(server).get(`/api/v1/public/invitations/${ownerSlug}`).expect(404);
    await request(server).get(`/api/v1/public/invitations/${ownerSlug}/render`).expect(404);
    await request(server).get('/api/v1/public/invitations/Invalid%20Slug').expect(404);
    await request(server).get('/api/v1/public/invitations/does-not-exist').expect(404);
  });

  it('validates publication input and protects owner-only modification', async () => {
    const server = app.getHttpServer();
    const path = `/api/v1/invitations/${ownerInvitationId}/publication`;
    await request(server).patch(path).send({ published: true }).expect(401);
    await withCookies(request(server).patch(path), ownerCookies)
      .send({ published: 'yes' })
      .expect(400);
    await withCookies(request(server).patch(path), otherCookies)
      .send({ published: true })
      .expect(404);
  });

  it('publishes and exposes only the saved public design without authentication', async () => {
    const server = app.getHttpServer();
    await withCookies(
      request(server).patch(`/api/v1/invitations/${ownerInvitationId}/publication`),
      ownerCookies
    )
      .send({ published: true })
      .expect(200)
      .expect((response) => {
        expect(response.body.status).toBe('PUBLISHED');
        expect(response.body.publishedAt).toEqual(expect.any(String));
      });

    await request(server)
      .get(`/api/v1/public/invitations/${ownerSlug}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          designSpecification: {
            theme: 'modern-contrast',
            content: {
              title: 'Published Garden Evening',
              venueLine: 'The Garden Room',
            },
          },
        });
        expect(response.body).not.toHaveProperty('id');
        expect(response.body).not.toHaveProperty('slug');
        expect(response.body).not.toHaveProperty('publishedAt');
        expect(response.body).not.toHaveProperty('event');
        expect(response.body).not.toHaveProperty('userId');
      });

    await request(server)
      .get(`/api/v1/public/invitations/${ownerSlug}/render`)
      .expect(200)
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect('X-Content-Type-Options', 'nosniff')
      .expect('X-Frame-Options', 'SAMEORIGIN')
      .expect('Referrer-Policy', 'no-referrer')
      .expect((response) => {
        const nonce = /<style nonce="([A-Za-z0-9_-]+)">/.exec(response.text)?.[1];
        expect(nonce).toBeDefined();
        expect(response.headers['content-security-policy']).toContain(
          `style-src 'nonce-${String(nonce)}'`
        );
        expect(response.headers['content-security-policy']).toContain("script-src 'none'");
        expect(response.headers['content-security-policy']).toContain("default-src 'none'");
        expect(response.text).toMatch(/^<!doctype html>/);
        expect(response.text).toContain('<title>Published Garden Evening</title>');
        expect(response.text).not.toContain('<script');
      });
  });

  it('unpublishes and immediately makes the public slug unavailable', async () => {
    const server = app.getHttpServer();
    await withCookies(
      request(server).patch(`/api/v1/invitations/${ownerInvitationId}/publication`),
      ownerCookies
    )
      .send({ published: false })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({ status: 'DRAFT', publishedAt: null });
      });
    await request(server).get(`/api/v1/public/invitations/${ownerSlug}`).expect(404);
    await request(server).get(`/api/v1/public/invitations/${ownerSlug}/render`).expect(404);
  });

  it('publishes and safely renders a sanitized standalone HTML artifact', async () => {
    await prisma.$transaction([
      prisma.invitationDesign.updateMany({
        where: { invitationId: ownerInvitationId, isActive: true },
        data: { isActive: false },
      }),
      prisma.invitationDesign.create({
        data: {
          invitationId: ownerInvitationId,
          version: 2,
          designSpecification: {
            format: 'html',
            version: 1,
            title: 'HTML Garden Evening',
            description: 'A standalone invitation',
            body: '<main class="card"><h1>HTML Garden Evening</h1><script>alert(1)</script></main>',
            css: '@import url(https://evil.example/x.css);.card{display:grid;background:url(https://tracker.example/pixel);color:#123}',
          },
          sourceType: 'AI_GENERATED',
          isActive: true,
        },
      }),
    ]);
    await withCookies(
      request(app.getHttpServer()).patch(`/api/v1/invitations/${ownerInvitationId}/publication`),
      ownerCookies
    )
      .send({ published: true })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/public/invitations/${ownerSlug}`)
      .expect(200)
      .expect((response) => {
        expect(response.body).toEqual({
          artifact: {
            format: 'html',
            version: 1,
            title: 'HTML Garden Evening',
            description: 'A standalone invitation',
          },
          renderPath: `/api/v1/public/invitations/${ownerSlug}/render`,
        });
      });

    await request(app.getHttpServer())
      .get(`/api/v1/public/invitations/${ownerSlug}/render`)
      .expect(200)
      .expect('Cross-Origin-Resource-Policy', 'same-origin')
      .expect('Cross-Origin-Opener-Policy', 'same-origin')
      .expect((response) => {
        expect(response.text).toContain('<main class="card"><h1>HTML Garden Evening</h1></main>');
        expect(response.text).toContain('display:grid');
        expect(response.text).toContain('color:#123');
        expect(response.text).not.toMatch(/<script|@import|url\(|evil|tracker/i);
        expect(response.headers['content-security-policy']).toContain("object-src 'none'");
        expect(response.headers['content-security-policy']).toContain("form-action 'none'");
      });
  });
});
