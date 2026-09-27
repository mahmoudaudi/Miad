import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { INVITATION_AI_PROVIDER } from '../src/invitation-designs/ai-provider.types';

describe('Authenticated invitation refinement e2e', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const emails = [`refine-owner-${suffix}@example.com`, `refine-other-${suffix}@example.com`];
  const password = 'invitation-refine-test-password-123';
  const slug = `refine-${suffix}`;
  let ownerCookies: string[];
  let otherCookies: string[];
  let invitationId: string;
  let providerCalls = 0;

  const withCookies = (test: request.Test, cookies: string[]) => test.set('Cookie', cookies);

  beforeAll(async () => {
    const provider = {
      refineHtml: async (input: {
        prompt: string;
        event: { title: string; venueName: string | null };
        project: { name: string };
      }) => {
        providerCalls += 1;
        expect(input.event).toMatchObject({
          title: 'Refinement Garden Dinner',
          venueName: 'The Garden Room',
        });
        expect(input.project.name).toBe('Original Garden Design');
        expect(input.prompt).toBe('Use emerald and gold accents.');
        return {
          artifact: {
            title: 'Emerald Garden Dinner',
            description: 'A garden dinner invitation',
            body: '<main><h1>Emerald Garden Dinner</h1></main>',
            css: 'body{background:#e8f1e8;color:#735c18}',
          },
          project: { name: 'Emerald Garden Dinner', description: 'Updated', files: [] },
          tokensUsed: 32,
          provider: 'deterministic-test-provider',
          model: 'test-model',
        };
      },
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(INVITATION_AI_PROVIDER)
      .useValue(provider)
      .compile();
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
    const register = async (email: string, firstName: string) => {
      const response = await request(server)
        .post('/api/v1/auth/register')
        .send({ firstName, lastName: 'Refinement', email, password })
        .expect(201);
      return response.headers['set-cookie'] as unknown as string[];
    };
    ownerCookies = await register(emails[0]!, 'Edit');
    otherCookies = await register(emails[1]!, 'Other');
    const event = await withCookies(request(server).post('/api/v1/events'), ownerCookies)
      .send({
        title: 'Refinement Garden Dinner',
        eventType: 'Dinner',
        eventDate: '2027-05-22',
        venueName: 'The Garden Room',
      })
      .expect(201);
    const invitation = await withCookies(request(server).post('/api/v1/invitations'), ownerCookies)
      .send({ eventId: event.body.id, slug })
      .expect(201);
    invitationId = invitation.body.id as string;
    await prisma.invitationDesign.create({
      data: {
        invitationId,
        version: 1,
        sourceType: 'AI_GENERATED',
        isActive: true,
        designSpecification: {
          format: 'html',
          version: 1,
          title: 'Original Garden Design',
          description: 'A garden dinner invitation',
          body: '<main><h1>Original Garden Design</h1></main>',
          css: 'body{background:#fff;color:#123}',
        },
      },
    });
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true },
    });
    const ids = users.map((user) => user.id);
    if (ids.length > 0) {
      await prisma.aiUsage.deleteMany({ where: { userId: { in: ids } } });
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

  it('creates a safe new version while keeping the published version until republish', async () => {
    const server = app.getHttpServer();
    const path = '/api/v1/ai/refine';
    const input = {
      invitationId,
      prompt: 'Use emerald and gold accents.',
      website: {
        name: 'Client supplied preview',
        description: 'This value is not trusted as the server source',
        files: [
          { path: 'index.html', content: '<main></main>' },
          { path: 'styles.css', content: 'body{color:#123}' },
        ],
      },
    };

    await withCookies(request(server).post(path), otherCookies).send(input).expect(404);
    expect(providerCalls).toBe(0);
    await withCookies(
      request(server).patch(`/api/v1/invitations/${invitationId}/publication`),
      ownerCookies
    )
      .send({ published: true })
      .expect(200);

    await request(server)
      .get(`/api/v1/public/invitations/${slug}/render`)
      .expect(200)
      .expect((response) => expect(response.text).toContain('Original Garden Design'));

    await withCookies(request(server).post(path), ownerCookies)
      .send(input)
      .expect(201)
      .expect((response) => {
        expect(response.body).toMatchObject({
          version: 2,
          sourceType: 'AI_EDIT',
          artifact: { title: 'Emerald Garden Dinner' },
        });
        expect(response.body.artifact.body).not.toContain('<script');
      });
    expect(providerCalls).toBe(1);

    const versions = await prisma.invitationDesign.findMany({
      where: { invitationId },
      orderBy: { version: 'asc' },
      select: { version: true, isActive: true, designSpecification: true },
    });
    expect(versions).toHaveLength(2);
    expect(versions[0]).toMatchObject({
      version: 1,
      isActive: false,
      designSpecification: { title: 'Original Garden Design' },
    });
    expect(versions[1]).toMatchObject({
      version: 2,
      isActive: true,
      designSpecification: { title: 'Emerald Garden Dinner' },
    });
    await request(server)
      .get(`/api/v1/public/invitations/${slug}/render`)
      .expect(200)
      .expect((response) => expect(response.text).toContain('Original Garden Design'));

    await withCookies(
      request(server).patch(`/api/v1/invitations/${invitationId}/publication`),
      ownerCookies
    )
      .send({ published: true })
      .expect(200);
    await request(server)
      .get(`/api/v1/public/invitations/${slug}/render`)
      .expect(200)
      .expect((response) => expect(response.text).toContain('Emerald Garden Dinner'));
  });
});
