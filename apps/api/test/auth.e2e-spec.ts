import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

/**
 * Auth e2e — full flow against the real database.
 * Creates a unique test user and deletes it afterwards.
 * Requires: roles seeded + valid DATABASE_URL + JWT secrets.
 */
describe('Auth e2e', () => {
  let app: INestApplication;
  let databaseConnected = false;
  const prisma = new PrismaClient();
  const email = `e2e-${Date.now()}@example.com`;
  const password = 'e2e-test-password-123';

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
    databaseConnected = true;
  });

  afterAll(async () => {
    if (databaseConnected) await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
    await app?.close();
  });

  it('register → me → refresh → logout → login', async () => {
    const server = app.getHttpServer();

    // Backend validation trims values and rejects whitespace-only names.
    await request(server)
      .post('/api/v1/auth/register')
      .send({ firstName: '   ', lastName: 'User', email: `invalid-${email}`, password })
      .expect(400);

    // Register (sets cookies).
    const reg = await request(server)
      .post('/api/v1/auth/register')
      .send({ firstName: 'E2E', lastName: 'User', email, password })
      .expect(201);
    expect(reg.body.email).toBe(email);
    expect(reg.body.passwordHash).toBeUndefined();
    const originalCookies = reg.headers['set-cookie'] as unknown as string[];
    expect(originalCookies.join(';')).toContain('access_token');

    // Duplicate register → 409.
    await request(server)
      .post('/api/v1/auth/register')
      .send({ firstName: 'E2E', lastName: 'User', email, password })
      .expect(409);

    // Bad login → 401 generic.
    await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password: 'wrong-pw-x' })
      .expect(401);

    // Me with cookie → 200; without → 401.
    const withCookies = (req: request.Test, cookies: string[]) => req.set('Cookie', cookies);
    await withCookies(request(server).get('/api/v1/auth/me'), originalCookies).expect(200);
    await request(server).get('/api/v1/auth/me').expect(401);

    // Refresh consumes the old version and rotates both cookies.
    const ref = await withCookies(
      request(server).post('/api/v1/auth/refresh'),
      originalCookies
    ).expect(200);
    expect(ref.body.email).toBe(email);
    const rotatedCookies = ref.headers['set-cookie'] as unknown as string[];
    expect(rotatedCookies.join(';')).toContain('refresh_token');

    // The consumed refresh and its paired access token are no longer usable.
    await withCookies(request(server).post('/api/v1/auth/refresh'), originalCookies).expect(401);
    await withCookies(request(server).get('/api/v1/auth/me'), originalCookies).expect(401);
    await withCookies(request(server).get('/api/v1/auth/me'), rotatedCookies).expect(200);

    // Invalid and expired refresh credentials fail and are cleared.
    const invalidRefresh = await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', ['refresh_token=not-a-token'])
      .expect(401);
    expect((invalidRefresh.headers['set-cookie'] as unknown as string[]).join(';')).toContain(
      'refresh_token='
    );
    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { role: true },
    });
    const expiredRefresh = new JwtService({}).sign(
      { sub: dbUser.id, email, role: dbUser.role.name, v: dbUser.tokenVersion },
      { secret: process.env.JWT_REFRESH_SECRET as string, expiresIn: -1 }
    );
    await request(server)
      .post('/api/v1/auth/refresh')
      .set('Cookie', [`refresh_token=${expiredRefresh}`])
      .expect(401);

    // Logout clears cookies and invalidates the currently rotated access token.
    const out = await withCookies(
      request(server).post('/api/v1/auth/logout'),
      rotatedCookies
    ).expect(200);
    expect(out.body.status).toBe('ok');
    expect((out.headers['set-cookie'] as unknown as string[]).join(';')).toContain('access_token=');
    await withCookies(request(server).get('/api/v1/auth/me'), rotatedCookies).expect(401);
    await request(server).get('/api/v1/auth/me').expect(401);

    // Login again works.
    const again = await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    expect(again.body.email).toBe(email);
  });
});
