import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

    expect(generateHtmlWithAi).toHaveBeenCalledWith(userId, 'inv-1', prompt);
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
});
