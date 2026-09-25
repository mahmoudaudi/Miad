import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

const SAFE_KEYS = [
  'category',
  'createdAt',
  'description',
  'id',
  'name',
  'slug',
  'specification',
];

describe('Templates e2e', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const hiddenSlug = `hidden-${Date.now()}-${Math.random().toString(16).slice(2)}`.toLowerCase();

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
  });

  afterAll(async () => {
    await prisma.template.deleteMany({ where: { slug: hiddenSlug } });
    await prisma.$disconnect();
    await app?.close();
  });

  it('serves the public catalog without authentication', async () => {
    const server = app.getHttpServer();
    const list = await request(server).get('/api/v1/templates').expect(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.length).toBeGreaterThan(0);
    for (const item of list.body) {
      expect(Object.keys(item).sort()).toEqual([...SAFE_KEYS].sort());
      expect(item.specification).toMatchObject({ schemaVersion: 1 });
    }
    const slugs = list.body.map((item: { slug: string }) => item.slug);
    expect(slugs).toContain('classic-ivory');
    // Display order is stable.
    const again = await request(server).get('/api/v1/templates').expect(200);
    expect(again.body.map((item: { slug: string }) => item.slug)).toEqual(slugs);
  });

  it('hides inactive templates from the public catalog', async () => {
    const server = app.getHttpServer();
    await prisma.template.create({
      data: {
        slug: hiddenSlug,
        name: 'Hidden Draft',
        description: 'Not public.',
        category: 'wedding',
        specification: { schemaVersion: 1 },
        isActive: false,
        sortOrder: 0,
      },
    });
    const list = await request(server).get('/api/v1/templates').expect(200);
    expect(list.body.map((item: { slug: string }) => item.slug)).not.toContain(hiddenSlug);
  });
});
