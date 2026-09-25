import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Invitation designs e2e', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const emails = [`design-a-${suffix}@example.com`, `design-b-${suffix}@example.com`];
  const password = 'invitation-design-test-password-123';
  let ownerCookies: string[];
  let otherCookies: string[];
  let ownerInvitationId: string;
  let otherInvitationId: string;

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
      .send({ firstName: 'Design', lastName: 'Owner', email: emails[0], password })
      .expect(201);
    const other = await request(server)
      .post('/api/v1/auth/register')
      .send({ firstName: 'Other', lastName: 'Designer', email: emails[1], password })
      .expect(201);
    ownerCookies = owner.headers['set-cookie'] as unknown as string[];
    otherCookies = other.headers['set-cookie'] as unknown as string[];

    const createInvitation = async (cookies: string[], title: string, slug: string) => {
      const event = await withCookies(request(server).post('/api/v1/events'), cookies)
        .send({ title, eventType: 'Dinner', eventDate: '2026-12-12' })
        .expect(201);
      return (
        await withCookies(request(server).post('/api/v1/invitations'), cookies)
          .send({ eventId: event.body.id, slug })
          .expect(201)
      ).body.id as string;
    };
    ownerInvitationId = await createInvitation(
      ownerCookies,
      'Owner Design Event',
      `owner-${suffix}`
    );
    otherInvitationId = await createInvitation(
      otherCookies,
      'Other Design Event',
      `other-${suffix}`
    );
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    const ids = users.map((user) => user.id);
    if (ids.length > 0) {
      await prisma.invitationDesign.deleteMany({
        where: { invitation: { event: { userId: { in: ids } } } },
      });
      await prisma.invitation.deleteMany({ where: { event: { userId: { in: ids } } } });
      await prisma.event.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.$disconnect();
    await app?.close();
  });

  it('requires authentication, validates presets, and protects invitation ownership', async () => {
    const server = app.getHttpServer();
    const path = `/api/v1/invitations/${ownerInvitationId}/design`;
    await request(server).get(path).expect(401);
    await request(server).post(path).send({ theme: 'classic-ivory' }).expect(401);
    await request(server)
      .patch(path)
      .send({ content: { title: 'Unauthorized' } })
      .expect(401);
    await withCookies(request(server).post(path), ownerCookies)
      .send({ theme: 'unknown-theme' })
      .expect(400);
    await withCookies(request(server).post(path), ownerCookies)
      .send({ theme: 'classic-ivory', userId: 'not-allowed' })
      .expect(400);
    await withCookies(request(server).patch(path), ownerCookies)
      .send({ colors: { background: 'not-a-color' } })
      .expect(400);
    await withCookies(
      request(server).post(`/api/v1/invitations/${otherInvitationId}/design`),
      ownerCookies
    )
      .send({ theme: 'classic-ivory' })
      .expect(404);
  });

  it('gets an empty current state and creates a persisted active design', async () => {
    const server = app.getHttpServer();
    const path = `/api/v1/invitations/${ownerInvitationId}/design`;
    await withCookies(request(server).get(path), ownerCookies).expect(200).expect({ design: null });

    await withCookies(request(server).post(path), ownerCookies)
      .send({ theme: '  CLASSIC-IVORY  ' })
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({
          invitationId: ownerInvitationId,
          version: 1,
          sourceType: 'MANUAL',
          isActive: true,
          designSpecification: { schemaVersion: 1, theme: 'classic-ivory' },
        });
      });
    await withCookies(request(server).post(path), ownerCookies)
      .send({ theme: 'modern-contrast' })
      .expect(409);
  });

  it('returns safe not-found responses across users and without an active design', async () => {
    const server = app.getHttpServer();
    const ownerPath = `/api/v1/invitations/${ownerInvitationId}/design`;
    await withCookies(request(server).get(ownerPath), otherCookies).expect(404);
    await withCookies(request(server).patch(ownerPath), otherCookies)
      .send({ theme: 'romantic-blush' })
      .expect(404);
    await withCookies(
      request(server).patch(`/api/v1/invitations/${otherInvitationId}/design`),
      otherCookies
    )
      .send({ theme: 'romantic-blush' })
      .expect(404);
  });

  it('updates theme and editor fields through versions, then removes related designs', async () => {
    const server = app.getHttpServer();
    const path = `/api/v1/invitations/${ownerInvitationId}/design`;
    await withCookies(request(server).patch(path), ownerCookies)
      .send({ theme: 'romantic-blush' })
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          version: 2,
          isActive: true,
          designSpecification: { theme: 'romantic-blush' },
        });
      });

    const editorSpecification = {
      theme: 'romantic-blush',
      content: {
        eyebrow: 'Join us for',
        title: 'An Evening Together',
        dateLine: 'Saturday, December 12',
        venueLine: 'The Lantern Garden',
      },
      colors: {
        background: '#F1F2F3',
        surface: '#FFFFFF',
        text: '#202122',
        accent: '#345678',
      },
      typography: { headingFamily: 'Inter', bodyFamily: 'Playfair Display' },
      layout: { alignment: 'left', density: 'compact' },
    };
    await withCookies(request(server).patch(path), ownerCookies)
      .send(editorSpecification)
      .expect(200)
      .expect((response) => {
        expect(response.body).toMatchObject({
          version: 3,
          isActive: true,
          designSpecification: editorSpecification,
        });
      });

    await withCookies(request(server).get(path), ownerCookies)
      .expect(200)
      .expect((response) => {
        expect(response.body.design).toMatchObject({
          version: 3,
          designSpecification: editorSpecification,
        });
      });
    const versions = await prisma.invitationDesign.findMany({
      where: { invitationId: ownerInvitationId },
      orderBy: { version: 'asc' },
      select: { version: true, isActive: true },
    });
    expect(versions).toEqual([
      { version: 1, isActive: false },
      { version: 2, isActive: false },
      { version: 3, isActive: true },
    ]);

    await withCookies(
      request(server).delete(`/api/v1/invitations/${ownerInvitationId}`),
      ownerCookies
    ).expect(204);
    await expect(
      prisma.invitationDesign.count({ where: { invitationId: ownerInvitationId } })
    ).resolves.toBe(0);
  });
});
