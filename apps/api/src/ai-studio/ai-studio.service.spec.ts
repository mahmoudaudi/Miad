import {
  BadGatewayException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AiGenerationCancelledError,
  InvitationAiProviderError,
} from '../invitation-designs/ai-provider.types';
import {
  AiGenerationProgressService,
  type AiGenerationStage,
} from './ai-generation-progress.service';
import { AiStudioService } from './ai-studio.service';

const userId = 'owner-1';
const prompt = 'An elegant garden birthday for Lina, ivory and gold, this December';

const storedEvent = {
  id: 'event-1',
  title: 'Lina Birthday',
  eventType: 'Birthday',
  eventDate: new Date('2026-12-12T00:00:00.000Z'),
  venueName: 'Rose Garden',
  createdAt: new Date('2026-09-24T00:00:00.000Z'),
  updatedAt: new Date('2026-09-24T00:00:00.000Z'),
};
const storedInvitation = {
  id: 'inv-1',
  eventId: 'event-1',
  slug: 'lina-birthday-abcdef12',
  status: 'DRAFT',
  publishedAt: null,
  createdAt: new Date('2026-09-24T00:00:00.000Z'),
  updatedAt: new Date('2026-09-24T00:00:00.000Z'),
};
const design = {
  id: 'design-1',
  invitationId: 'inv-1',
  version: 1,
  sourceType: 'AI_GENERATED',
  isActive: true,
  createdAt: new Date('2026-09-24T00:00:00.000Z').toISOString(),
  artifact: {
    format: 'html' as const,
    version: 1 as const,
    title: 'Lina Birthday',
    description: 'An elegant garden birthday',
    body: '<main><h1>Lina Birthday</h1></main>',
    css: 'body{margin:0}',
  },
};

function txPrisma() {
  const calls: string[] = [];
  const tx = {
    event: {
      create: async (args: { data: unknown }) => {
        calls.push('event.create');
        return { ...storedEvent, ...(args.data as Record<string, unknown>) };
      },
    },
    invitation: {
      create: async (args: { data: unknown }) => {
        calls.push('invitation.create');
        return { ...storedInvitation, ...(args.data as Record<string, unknown>) };
      },
    },
  };
  const prisma = {
    $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
  };
  return { prisma, calls };
}

describe('AiStudioService', () => {
  it('creates event, invitation, and design in one shot from a prompt', async () => {
    const order: string[] = [];
    const { prisma, calls } = txPrisma();
    const provider = {
      extractEventDetails: async () => {
        order.push('extract');
        return {
          title: 'Lina Birthday',
          eventType: 'Birthday',
          eventDate: '2026-12-12',
          venueName: 'Rose Garden',
        };
      },
    };
    const generateHtmlWithAi = jest.fn(async () => {
      order.push('generate');
      return design;
    });
    const designs = { generateHtmlWithAi };
    const service = new AiStudioService(prisma as never, designs as never, provider as never);
    const result = await service.createFromPrompt(userId, prompt);

    expect(generateHtmlWithAi).toHaveBeenCalledWith(userId, 'inv-1', prompt, undefined, undefined);
    expect(generateHtmlWithAi).not.toHaveBeenCalledWith(
      userId,
      'inv-1',
      expect.objectContaining({ currentDesign: expect.anything() })
    );
    expect(order).toEqual(['extract', 'generate']);
    expect(calls).toEqual(['event.create', 'invitation.create']);
    expect(result.event).toMatchObject({
      id: 'event-1',
      title: 'Lina Birthday',
      eventType: 'Birthday',
      eventDate: '2026-12-12',
      venueName: 'Rose Garden',
    });
    expect(result.invitation).toMatchObject({
      id: 'inv-1',
      eventId: 'event-1',
      status: 'DRAFT',
      publishedAt: null,
    });
    expect(result.invitation.slug).toMatch(/^lina-birthday-[0-9a-f]{8}$/);
    expect(result.design).toMatchObject({
      version: 1,
      sourceType: 'AI_GENERATED',
      artifact: { format: 'html', version: 1 },
    });
    expect(result.design).not.toHaveProperty('designSpecification');
    expect(result.aiError).toBeNull();
  });

  it('falls back to deterministic details when extraction fails', async () => {
    const { prisma } = txPrisma();
    const provider = {
      extractEventDetails: async () => {
        throw new Error('provider down');
      },
    };
    const designs = { generateHtmlWithAi: async () => design };
    const service = new AiStudioService(prisma as never, designs as never, provider as never);
    const result = await service.createFromPrompt(userId, prompt);
    expect(result.event.title).toBe(prompt);
    expect(result.event.eventType).toBe('Celebration');
    expect(result.event.eventDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.design).toMatchObject({ version: 1 });
    expect(result.aiError).toBeNull();
  });

  it('clamps invalid extracted values instead of persisting them', async () => {
    let data: unknown;
    const prisma = {
      $transaction: async (cb: (tx: unknown) => Promise<unknown>) =>
        cb({
          event: {
            create: async (args: { data: unknown }) => {
              data = args.data;
              return { ...storedEvent, ...(args.data as Record<string, unknown>) };
            },
          },
          invitation: { create: async () => storedInvitation },
        }),
    };
    const provider = {
      extractEventDetails: async () => ({
        title: '   ',
        eventType: '',
        eventDate: 'not-a-date',
        venueName: 42,
      }),
    };
    const designs = { generateHtmlWithAi: async () => design };
    const service = new AiStudioService(prisma as never, designs as never, provider as never);
    await service.createFromPrompt(userId, prompt);
    expect(data).toMatchObject({
      userId,
      eventType: 'Celebration',
      venueName: null,
    });
    expect((data as { title: string }).title.length).toBeGreaterThan(0);
  });

  it('keeps event and invitation when design generation fails', async () => {
    const { prisma } = txPrisma();
    const provider = { extractEventDetails: async () => ({ title: 'T', eventType: 'E' }) };
    const { ServiceUnavailableException } = await import('@nestjs/common');
    const designs = {
      generateHtmlWithAi: async () => {
        throw new ServiceUnavailableException('AI generation is not configured.');
      },
    };
    const service = new AiStudioService(prisma as never, designs as never, provider as never);
    const result = await service.createFromPrompt(userId, prompt);
    expect(result.event.id).toBe('event-1');
    expect(result.invitation.id).toBe('inv-1');
    expect(result.design).toBeNull();
    expect(result.aiError).toBe('AI generation is not configured.');
  });

  it('emits each real generation boundary through a successful save', async () => {
    const { prisma } = txPrisma();
    const provider = { extractEventDetails: async () => ({ title: 'T', eventType: 'E' }) };
    const progress = new AiGenerationProgressService();
    const generationId = '11111111-1111-4111-8111-111111111111';
    const stages: AiGenerationStage[] = [];
    const subscription = progress.observe(userId, generationId).subscribe((update) => {
      stages.push(update.stage);
    });
    const designs = {
      generateHtmlWithAi: async (
        _userId: string,
        _invitationId: string,
        _prompt: string,
        onProgress?: (stage: 'PARSING_RESPONSE' | 'VALIDATING_WEBSITE' | 'SAVING_WEBSITE') => void
      ) => {
        onProgress?.('PARSING_RESPONSE');
        onProgress?.('VALIDATING_WEBSITE');
        onProgress?.('SAVING_WEBSITE');
        return design;
      },
    };
    const service = new AiStudioService(
      prisma as never,
      designs as never,
      provider as never,
      progress
    );

    const result = await service.createFromPrompt(userId, prompt, generationId);
    subscription.unsubscribe();

    expect(result.design).toEqual(design);
    expect(stages).toEqual([
      'REQUEST_RECEIVED',
      'ANALYZING_EVENT',
      'GENERATING_WEBSITE',
      'PARSING_RESPONSE',
      'VALIDATING_WEBSITE',
      'SAVING_WEBSITE',
      'COMPLETED',
    ]);
  });

  it('maps slug collisions to a safe conflict error', async () => {
    const provider = { extractEventDetails: async () => ({}) };
    const prisma = {
      $transaction: async () => {
        throw new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: 'test',
        });
      },
    };
    const designs = { generateHtmlWithAi: async () => design };
    const service = new AiStudioService(prisma as never, designs as never, provider as never);
    await expect(service.createFromPrompt(userId, prompt)).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it('propagates caller cancellation without failure progress or a fallback payload', async () => {
    const { prisma } = txPrisma();
    const provider = { extractEventDetails: async () => ({ title: 'T', eventType: 'E' }) };
    const progress = new AiGenerationProgressService();
    const generationId = '11111111-1111-4111-8111-111111111111';
    const updates: Array<{ stage: AiGenerationStage; status: string }> = [];
    const subscription = progress.observe(userId, generationId).subscribe((update) => {
      updates.push({ stage: update.stage, status: update.status });
    });
    const designs = {
      generateHtmlWithAi: async () => {
        throw new AiGenerationCancelledError();
      },
    };
    const service = new AiStudioService(
      prisma as never,
      designs as never,
      provider as never,
      progress
    );
    const controller = new AbortController();
    await expect(
      service.createFromPrompt(userId, prompt, generationId, controller.signal)
    ).rejects.toBeInstanceOf(AiGenerationCancelledError);
    subscription.unsubscribe();
    // The stream stays at GENERATING_WEBSITE: no FAILED, no COMPLETED, and no
    // 201 fallback payload with a provider-failure message.
    expect(updates.some((update) => update.status === 'FAILED')).toBe(false);
    expect(updates.some((update) => update.status === 'COMPLETED')).toBe(false);
    expect(updates.at(-1)).toMatchObject({ stage: 'GENERATING_WEBSITE', status: 'ACTIVE' });
  });
});

describe('AiStudioService.analyze', () => {
  const analyzePrompt = 'Tech Founder Dinner';

  function service(analyzeDetails: jest.Mock, prisma: unknown = { $transaction: jest.fn() }) {
    return new AiStudioService(prisma as never, {} as never, { analyzeDetails } as never);
  }

  it('asks for a question when a short prompt lacks detail, without creating anything', async () => {
    const analyzeDetails = jest.fn(async () => ({
      status: 'QUESTION',
      question: {
        id: 'atmosphere',
        text: 'What kind of atmosphere would you like for the dinner?',
        type: 'single_select',
        options: [
          { label: 'Modern', value: 'Modern' },
          { label: 'Luxury', value: 'Luxury' },
        ],
        allowOther: true,
      },
      collectedData: { eventType: 'Dinner' },
    }));
    const prisma = { $transaction: jest.fn(), invitationDesign: { create: jest.fn() } };

    const result = await service(analyzeDetails, prisma).analyze({ prompt: analyzePrompt });

    expect(result).toMatchObject({
      status: 'QUESTION',
      question: { id: 'atmosphere', type: 'single_select' },
    });
    // Analysis is side-effect free: no invitation, no design, no event.
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.invitationDesign.create).not.toHaveBeenCalled();
  });

  it('returns READY with the merged brief for an already detailed prompt', async () => {
    const analyzeDetails = jest.fn(async () => ({
      status: 'READY',
      collectedData: {
        eventType: 'Wedding',
        names: ['Ahmad', 'Sara'],
        date: '2026-12-20',
        location: 'Beirut',
        style: 'Luxury',
      },
    }));

    const result = await service(analyzeDetails).analyze({
      prompt: 'Luxury wedding invitation for Ahmad and Sara in Beirut on December 20, 2026.',
    });

    expect(result.status).toBe('READY');
    if (result.status !== 'READY') return;
    expect(result.question).toBeNull();
    expect(result.collectedData).toMatchObject({
      eventType: 'Wedding',
      date: '2026-12-20',
      style: 'Luxury',
    });
  });

  it('sends the prompt, brief, answers, and last question to the provider', async () => {
    const analyzeDetails = jest.fn(async () => ({ status: 'READY', collectedData: {} }));
    const signal = new AbortController().signal;

    await service(analyzeDetails).analyze(
      {
        prompt: 'Tech Founder Dinner',
        collectedData: { eventType: 'Corporate Dinner' },
        answers: [{ questionId: 'atmosphere', value: 'Modern' }],
        lastQuestionId: 'atmosphere',
      },
      signal
    );

    expect(analyzeDetails).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: 'Tech Founder Dinner',
        collectedData: { eventType: 'Corporate Dinner' },
        answers: [{ questionId: 'atmosphere', value: 'Modern' }],
        lastQuestionId: 'atmosphere',
        signal,
      })
    );
  });

  it('preserves multiple answers, including multi-value ones', async () => {
    const analyzeDetails = jest.fn(
      async (_input: { answers?: unknown }) => ({ status: 'READY', collectedData: {} })
    );

    await service(analyzeDetails).analyze({
      prompt: 'Tech Founder Dinner',
      answers: [
        { questionId: 'atmosphere', value: ['Modern', 'Professional'] },
        { questionId: 'venue-name', value: 'The Garden Ballroom' },
      ],
    });

    expect((analyzeDetails.mock.calls[0]?.[0] as { answers: unknown }).answers).toEqual([
      { questionId: 'atmosphere', value: ['Modern', 'Professional'] },
      { questionId: 'venue-name', value: 'The Garden Ballroom' },
    ]);
  });

  it('rejects a malformed model response with a safe error', async () => {
    const malformed = [
      { status: 'MAYBE', collectedData: {} },
      { status: 'QUESTION', question: { id: 'x', text: 'Q', type: 'slider', options: [] } },
      { status: 'QUESTION', question: { id: 'x', text: 'Q', type: 'single_select', options: [] } },
      { status: 'QUESTION', collectedData: {} },
      'not an object',
      null,
    ];
    for (const raw of malformed) {
      const analyzeDetails = jest.fn(async () => raw);
      const error = await service(analyzeDetails)
        .analyze({ prompt: analyzePrompt })
        .catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(BadGatewayException);
      // Never leaks the raw model response to the client.
      expect(String((error as Error).message)).not.toContain('slider');
    }
  });

  it('never surfaces a raw provider error when analysis fails', async () => {
    const analyzeDetails = jest.fn(async () => {
      throw new InvitationAiProviderError('OpenRouter 500: key sk-secret leaked', 'provider');
    });
    const error = await service(analyzeDetails)
      .analyze({ prompt: analyzePrompt })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BadGatewayException);
    const message = String((error as Error).message);
    expect(message).toBe('The assistant could not analyse the request. Please try again.');
    expect(message).not.toContain('sk-secret');
    expect(message).not.toContain('OpenRouter');
  });

  it('propagates cancellation as cancellation, not as an analysis failure', async () => {
    const analyzeDetails = jest.fn(async () => {
      throw new AiGenerationCancelledError();
    });
    await expect(service(analyzeDetails).analyze({ prompt: analyzePrompt })).rejects.toBeInstanceOf(
      AiGenerationCancelledError
    );
  });

  it('reports a missing provider as unavailable', async () => {
    const missing = new AiStudioService({} as never, {} as never, undefined as never);
    await expect(missing.analyze({ prompt: analyzePrompt })).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });
});
