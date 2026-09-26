import { EventEmitter } from 'node:events';
import { VersioningType } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AiGenerationCancelledError } from '../invitation-designs/ai-provider.types';
import { AiGenerationProgressService } from './ai-generation-progress.service';
import { AiStudioController } from './ai-studio.controller';
import { AiStudioService } from './ai-studio.service';

const generationId = '11111111-1111-4111-8111-111111111111';
const prompt = 'An elegant garden birthday for Lina, ivory and gold, this December';

function fakeReq(writableEnded: boolean) {
  const res = new EventEmitter() as EventEmitter & { writableEnded: boolean };
  res.writableEnded = writableEnded;
  return { req: { res } as never, res };
}

describe('AiStudioController generate', () => {
  it('aborts only its own provider signal when the client disconnects', async () => {
    let resolveGeneration!: (value: unknown) => void;
    const signals: Array<AbortSignal | undefined> = [];
    const studio = {
      createFromPrompt: jest.fn(
        (_userId: string, _prompt: string, _id?: string, signal?: AbortSignal) => {
          signals.push(signal);
          return new Promise((resolve) => {
            resolveGeneration = resolve;
          });
        }
      ),
    };
    const controller = new AiStudioController(studio as never, {} as never);
    const { req, res } = fakeReq(false);
    const pending = controller.generate(
      { sub: 'user-1' } as never,
      { prompt, generationId } as never,
      req
    );
    expect(signals).toHaveLength(1);
    expect(signals[0]).toBeInstanceOf(AbortSignal);
    expect(signals[0]?.aborted).toBe(false);
    res.emit('close');
    expect(signals[0]?.aborted).toBe(true);
    resolveGeneration({ ok: true });
    await expect(pending).resolves.toEqual({ ok: true });
  });

  it('leaves the signal alone when the response already completed', async () => {
    let captured: AbortSignal | undefined;
    const studio = {
      createFromPrompt: jest.fn(async (_u: string, _p: string, _g?: string, s?: AbortSignal) => {
        captured = s;
        return { ok: true };
      }),
    };
    const controller = new AiStudioController(studio as never, {} as never);
    const { req, res } = fakeReq(true);
    await expect(
      controller.generate({ sub: 'user-1' } as never, { prompt, generationId } as never, req)
    ).resolves.toEqual({ ok: true });
    res.emit('close');
    expect(captured?.aborted).toBe(false);
  });

  it('aborts only its own analysis request on client disconnect', async () => {
    let captured: AbortSignal | undefined;
    const studio = {
      analyze: jest.fn(async (_dto: unknown, signal?: AbortSignal) => {
        captured = signal;
        throw new AiGenerationCancelledError();
      }),
    };
    const controller = new AiStudioController(studio as never, {} as never);
    const { req, res } = fakeReq(false);
    res.writableEnded = true;
    await expect(
      controller.analyze(
        { sub: 'user-1' } as never,
        { prompt: 'Tech Founder Dinner' } as never,
        req
      )
    ).resolves.toBeUndefined();
    expect(captured).toBeInstanceOf(AbortSignal);
    expect(captured?.aborted).toBe(false);
  });

  it('forwards a real analysis result unchanged', async () => {
    const analysis = {
      status: 'QUESTION',
      question: {
        id: 'atmosphere',
        text: 'What kind of atmosphere would you like for the dinner?',
        type: 'single_select',
        options: [{ label: 'Modern', value: 'Modern' }],
        allowOther: true,
      },
      collectedData: { eventType: 'Dinner' },
    };
    const studio = { analyze: jest.fn(async () => analysis) };
    const controller = new AiStudioController(studio as never, {} as never);
    const { req } = fakeReq(true);
    await expect(
      controller.analyze(
        { sub: 'user-1' } as never,
        { prompt: 'Tech Founder Dinner' } as never,
        req
      )
    ).resolves.toEqual(analysis);
  });
});

describe('AI Studio rate limits', () => {
  /**
   * Behavioural check: the guard must actually reject excess analysis calls
   * with 429. The studio service is stubbed, so no provider is contacted.
   */
  it('rejects analysis beyond its per-route limit and never exceeds the global limit', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }])],
      controllers: [AiStudioController],
      providers: [
        {
          provide: AiStudioService,
          useValue: {
            analyze: jest.fn(async () => ({
              status: 'READY',
              collectedData: {},
              question: null,
            })),
          },
        },
        {
          provide: AiGenerationProgressService,
          useValue: { observe: () => ({ subscribe: () => ({ unsubscribe: () => undefined }) }) },
        },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    await app.init();
    const server = app.getHttpServer();

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const response = await request(server)
        .post('/api/v1/ai/analyze')
        .send({ prompt: 'Tech Founder Dinner' });
      statuses.push(response.status);
    }
    await app.close();

    // The route limit (20/min) trips before the global limit (100/min).
    expect(statuses.filter((status) => status === 429).length).toBe(5);
    expect(statuses.filter((status) => status === 201).length).toBe(20);
  }, 30000);
});
