import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InvitationAiProviderError } from './ai-provider.types';
import { InvitationDesignsService } from './invitation-designs.service';

const invitationId = '11111111-1111-4111-8111-111111111111';
const event = {
  title: 'Garden Dinner',
  eventType: 'Dinner',
  description: 'A calm evening among the garden',
  eventDate: new Date('2026-12-12T00:00:00.000Z'),
  startTime: new Date('1970-01-01T18:30:00.000Z'),
  endTime: new Date('1970-01-01T22:00:00.000Z'),
  venueName: 'The Garden Room',
  venueAddress: null,
};
const specification = {
  schemaVersion: 1 as const,
  theme: 'classic-ivory' as const,
  content: {
    eyebrow: 'You are invited',
    title: 'Garden Dinner',
    dateLine: 'December 12, 2026',
    venueLine: 'The Garden Room',
  },
  colors: {
    background: '#FFFDF8',
    surface: '#FFFFFF',
    text: '#241C18',
    accent: '#8B7355',
  },
  typography: { headingFamily: 'Playfair Display' as const, bodyFamily: 'Inter' as const },
  layout: { alignment: 'center' as const, density: 'airy' as const },
};
const designRecord = {
  id: '22222222-2222-4222-8222-222222222222',
  invitationId,
  version: 1,
  designSpecification: specification,
  sourceType: 'MANUAL',
  isActive: true,
  createdAt: new Date('2026-09-20T00:00:00.000Z'),
};

describe('InvitationDesignsService', () => {
  it('gets and normalizes the active design with invitation ownership', async () => {
    let query: unknown;
    const prisma = {
      invitation: {
        findFirst: async (args: unknown) => {
          query = args;
          return {
            event,
            designs: [
              { ...designRecord, designSpecification: { ...specification, content: undefined } },
            ],
          };
        },
      },
    };
    const result = await new InvitationDesignsService(prisma as never).findCurrent(
      'owner-1',
      invitationId
    );
    expect(query).toMatchObject({
      where: { id: invitationId, event: { userId: 'owner-1' } },
      select: { designs: { where: { isActive: true }, take: 1 } },
    });
    expect(result.design).toMatchObject({
      version: 1,
      isActive: true,
      designSpecification: { content: { title: 'Garden Dinner' } },
    });
  });

  it('returns an explicit empty design for an owned invitation', async () => {
    const service = new InvitationDesignsService({
      invitation: { findFirst: async () => ({ event, designs: [] }) },
    } as never);
    await expect(service.findCurrent('owner-1', invitationId)).resolves.toEqual({ design: null });
  });

  it('returns only the published public specification without private identifiers', async () => {
    let query: unknown;
    const service = new InvitationDesignsService({
      invitation: {
        findFirst: async (args: unknown) => {
          query = args;
          return {
            event,
            designs: [{ designSpecification: specification }],
          };
        },
      },
    } as never);
    const result = await service.findPublished('garden-dinner');
    expect(query).toMatchObject({
      where: {
        slug: 'garden-dinner',
        status: 'PUBLISHED',
        publishedAt: { not: null },
      },
      select: {
        event: { select: { title: true } },
        designs: { where: { isActive: true }, take: 1 },
      },
    });
    expect(result).toHaveProperty('designSpecification');
    if (!('designSpecification' in result)) throw new Error('Expected a legacy design response.');
    expect(result.designSpecification).toMatchObject(specification);
    expect(result.designSpecification.sections).toHaveLength(4);
    expect(result.designSpecification.elements).toHaveLength(4);
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('userId');
  });

  it('hides drafts, missing designs, and invalid public slugs behind not-found', async () => {
    const service = new InvitationDesignsService({
      invitation: { findFirst: async () => null },
    } as never);
    await expect(service.findPublished('draft-invitation')).rejects.toBeInstanceOf(
      NotFoundException
    );
    await expect(service.findPublished('Invalid Slug')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates the first active manual design with event-derived content', async () => {
    let data: unknown;
    const prisma = {
      invitation: { findFirst: async () => ({ id: invitationId, event, designs: [] }) },
      invitationDesign: {
        create: async (args: { data: unknown }) => {
          data = args.data;
          return designRecord;
        },
      },
    };
    await new InvitationDesignsService(prisma as never).create(
      'owner-1',
      invitationId,
      'classic-ivory'
    );
    expect(data).toMatchObject({
      invitationId,
      version: 1,
      sourceType: 'MANUAL',
      isActive: true,
      designSpecification: {
        schemaVersion: 1,
        theme: 'classic-ivory',
        content: { title: 'Garden Dinner', venueLine: 'The Garden Room' },
      },
    });
  });

  it('persists validated editor fields as a new active version', async () => {
    const calls: unknown[] = [];
    const nextSpecification = {
      ...specification,
      content: { ...specification.content, title: 'An Evening Together' },
      colors: { ...specification.colors, accent: '#123456' },
      typography: { headingFamily: 'Inter' as const, bodyFamily: 'Playfair Display' as const },
      layout: { alignment: 'left' as const, density: 'compact' as const },
    };
    const updatedRecord = {
      ...designRecord,
      version: 2,
      designSpecification: nextSpecification,
    };
    const prisma = {
      invitation: {
        findFirst: async () => ({ id: invitationId, event, designs: [designRecord] }),
      },
      invitationDesign: {
        updateMany: async (args: unknown) => {
          calls.push(args);
          return { count: 1 };
        },
        create: async (args: unknown) => {
          calls.push(args);
          return updatedRecord;
        },
      },
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    };
    const result = await new InvitationDesignsService(prisma as never).update(
      'owner-1',
      invitationId,
      {
        content: nextSpecification.content,
        colors: nextSpecification.colors,
        typography: nextSpecification.typography,
        layout: nextSpecification.layout,
      }
    );
    expect(calls[0]).toMatchObject({
      where: { invitationId, isActive: true },
      data: { isActive: false },
    });
    expect(calls[1]).toMatchObject({
      data: {
        invitationId,
        version: 2,
        designSpecification: {
          content: { title: 'An Evening Together' },
          colors: { accent: '#123456' },
          typography: { bodyFamily: 'Playfair Display' },
          layout: { alignment: 'left', density: 'compact' },
        },
      },
    });
    expect(result).toMatchObject({
      version: 2,
      designSpecification: { content: { title: 'An Evening Together' } },
    });
  });

  it('rejects empty and unchanged updates without creating versions', async () => {
    const service = new InvitationDesignsService({
      invitation: {
        findFirst: async () => ({ id: invitationId, event, designs: [designRecord] }),
      },
    } as never);
    await expect(service.update('owner-1', invitationId, {})).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(
      service.update('owner-1', invitationId, { content: specification.content })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses safe missing/conflict outcomes for inaccessible or already-designed invitations', async () => {
    const missing = new InvitationDesignsService({
      invitation: { findFirst: async () => null },
    } as never);
    await expect(missing.findCurrent('owner-2', invitationId)).rejects.toBeInstanceOf(
      NotFoundException
    );

    const existing = new InvitationDesignsService({
      invitation: { findFirst: async () => ({ id: invitationId, event, designs: [designRecord] }) },
    } as never);
    await expect(existing.create('owner-1', invitationId, 'romantic-blush')).rejects.toBeInstanceOf(
      ConflictException
    );
  });

  it('generates an AI design through the configured provider and persists sanitized output', async () => {
    const calls: unknown[] = [];
    let providerInput: unknown;
    const prisma = {
      invitation: {
        findFirst: async () => ({ id: invitationId, event, designs: [designRecord] }),
      },
      invitationDesign: {
        updateMany: async (args: unknown) => {
          calls.push(args);
          return { count: 1 };
        },
        create: async (args: { data: { designSpecification: unknown } }) => {
          calls.push(args);
          return {
            ...designRecord,
            version: 2,
            sourceType: 'AI_GENERATED',
            designSpecification: args.data.designSpecification,
          };
        },
      },
      aiUsage: {
        create: async (args: unknown) => {
          calls.push(args);
          return { id: 'usage-1' };
        },
      },
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    };
    const provider = {
      generateDesign: async (input: unknown) => {
        providerInput = input;
        return {
          provider: 'test',
          model: 'test-model',
          tokensUsed: 321,
          specification: {
            schemaVersion: 1,
            theme: 'modern-contrast',
            content: {
              eyebrow: 'Garden evening',
              title: 'Garden Dinner',
              dateLine: 'December 12, 2026',
              venueLine: 'The Garden Room',
            },
            colors: { background: '#BADBAD', surface: '#FFFFFF', text: '#111111', accent: 'bad' },
            typography: { headingFamily: 'Inter', bodyFamily: 'Inter' },
            layout: { alignment: 'left', density: 'compact' },
            sections: [
              {
                id: 'story',
                type: 'story',
                title: 'Story',
                body: 'A polished note.',
                order: 1.7,
                visible: true,
              },
            ],
            elements: [
              {
                id: 'title',
                type: 'text',
                label: 'Title',
                text: 'Garden Dinner',
                x: 12.4,
                y: 24.9,
                width: 80,
                height: 20,
                fontSize: 44,
                color: '#111111',
              },
            ],
          },
        };
      },
    };

    const result = await new InvitationDesignsService(
      prisma as never,
      provider as never
    ).generateWithAi('owner-1', invitationId, {
      prompt: 'Make a modern garden dinner invitation',
      mode: 'generate',
    });

    expect(providerInput).toMatchObject({
      operation: 'generate',
      event: { title: 'Garden Dinner', eventDate: '2026-12-12' },
      currentDesign: { content: { title: 'Garden Dinner' } },
    });
    expect(calls[1]).toMatchObject({
      data: {
        version: 2,
        sourceType: 'AI_GENERATED',
        designSpecification: {
          theme: 'modern-contrast',
          colors: { accent: '#7A263A' },
          elements: [{ x: 12, y: 25 }],
        },
      },
    });
    expect(calls[2]).toMatchObject({
      data: { operationType: 'GENERATE_DESIGN', status: 'SUCCEEDED', tokensUsed: 321 },
    });
    expect(result).toMatchObject({
      version: 2,
      sourceType: 'AI_GENERATED',
      designSpecification: { content: { eyebrow: 'Garden evening' } },
    });
  });

  it('generates, sanitizes, and versions standalone HTML without reading a current design', async () => {
    const calls: unknown[] = [];
    let providerInput: Record<string, unknown> | undefined;
    const prisma = {
      invitation: {
        findFirst: async (args: unknown) => {
          expect(args).toMatchObject({
            where: { id: invitationId, event: { userId: 'owner-1' } },
            select: { designs: { select: { version: true } } },
          });
          return { id: invitationId, event, designs: [{ version: 1 }] };
        },
      },
      invitationDesign: {
        updateMany: async (args: unknown) => {
          calls.push(args);
          return { count: 1 };
        },
        create: async (args: { data: Record<string, unknown> }) => {
          calls.push(args);
          return {
            ...designRecord,
            version: 2,
            sourceType: 'AI_GENERATED',
            designSpecification: args.data.designSpecification,
          };
        },
      },
      aiUsage: {
        create: async (args: unknown) => {
          calls.push(args);
          return { id: 'usage-html' };
        },
      },
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    };
    const provider = {
      generateHtml: async (input: Record<string, unknown>) => {
        providerInput = input;
        return {
          provider: 'test',
          model: 'test-model',
          tokensUsed: 654,
          artifact: {
            title: 'Garden Dinner',
            description: 'A calm evening among the garden',
            body: '<main class="card"><h1>Garden Dinner</h1><script>alert(1)</script></main>',
            css: 'body{background:url(https://tracker.example);color:#123}.card{display:grid}',
          },
        };
      },
    };

    const result = await new InvitationDesignsService(
      prisma as never,
      provider as never
    ).generateHtmlWithAi('owner-1', invitationId, 'Create a calm garden dinner invitation');

    expect(providerInput).toEqual({
      prompt: 'Create a calm garden dinner invitation',
      event: {
        title: 'Garden Dinner',
        eventType: 'Dinner',
        description: 'A calm evening among the garden',
        eventDate: '2026-12-12',
        startTime: '18:30',
        endTime: '22:00',
        venueName: 'The Garden Room',
        venueAddress: null,
      },
    });
    expect(providerInput).not.toHaveProperty('currentDesign');
    expect(providerInput).not.toHaveProperty('specification');
    expect(calls[1]).toMatchObject({
      data: {
        invitationId,
        version: 2,
        sourceType: 'AI_GENERATED',
        designSpecification: {
          format: 'html',
          version: 1,
          body: '<main class="card"><h1>Garden Dinner</h1></main>',
          css: 'body{color:#123}.card{display:grid}',
        },
      },
    });
    expect(calls[2]).toMatchObject({
      data: { operationType: 'GENERATE_DESIGN', status: 'SUCCEEDED', tokensUsed: 654 },
    });
    expect(result).toMatchObject({
      version: 2,
      sourceType: 'AI_GENERATED',
      artifact: { format: 'html', version: 1 },
    });
    expect(result).not.toHaveProperty('designSpecification');
  });

  it('keeps HTML artifacts out of the legacy public JSON body and exposes render metadata', async () => {
    const stored = {
      format: 'html',
      version: 1,
      title: 'Garden Dinner',
      description: 'A calm evening',
      body: '<main><h1>Garden Dinner</h1><script>alert(1)</script></main>',
      css: 'body{color:#123}',
    };
    const service = new InvitationDesignsService({
      invitation: {
        findFirst: async () => ({ event, designs: [{ designSpecification: stored }] }),
      },
    } as never);

    await expect(service.findPublished('garden-dinner')).resolves.toEqual({
      artifact: {
        format: 'html',
        version: 1,
        title: 'Garden Dinner',
        description: 'A calm evening',
      },
      renderPath: '/api/v1/public/invitations/garden-dinner/render',
    });
    await expect(service.findPublishedRenderable('garden-dinner')).resolves.toEqual({
      ...stored,
      body: '<main><h1>Garden Dinner</h1></main>',
      css: 'body{color:#123}',
    });
  });

  it('logs failed AI usage and returns a safe configuration error', async () => {
    const calls: unknown[] = [];
    const prisma = {
      invitation: {
        findFirst: async () => ({ id: invitationId, event, designs: [] }),
      },
      aiUsage: {
        create: async (args: unknown) => {
          calls.push(args);
          return { id: 'usage-failed' };
        },
      },
    };
    const provider = {
      generateDesign: async () => {
        throw new InvitationAiProviderError('missing key', 'configuration');
      },
    };
    await expect(
      new InvitationDesignsService(prisma as never, provider as never).generateWithAi(
        'owner-1',
        invitationId,
        { prompt: 'Create a garden invitation' }
      )
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(calls).toEqual([
      {
        data: {
          userId: 'owner-1',
          invitationId,
          operationType: 'GENERATE_DESIGN',
          status: 'FAILED',
          tokensUsed: null,
        },
        select: { id: true },
      },
    ]);
  });

  it('never deletes or modifies the invitation when AI times out', async () => {
    const destructive: string[] = [];
    const fail = () => {
      destructive.push('called');
      throw new Error('must not delete on AI failure');
    };
    const prisma = {
      invitation: {
        findFirst: async () => ({ id: invitationId, event, designs: [] }),
        delete: fail,
        deleteMany: fail,
        update: fail,
        updateMany: fail,
      },
      event: { delete: fail, deleteMany: fail, update: fail, updateMany: fail },
      invitationDesign: {
        updateMany: fail,
        create: fail,
        delete: fail,
        deleteMany: fail,
      },
      aiUsage: { create: async () => ({ id: 'usage-failed' }) },
    };
    const provider = {
      generateDesign: async () => {
        throw new InvitationAiProviderError('timed out', 'timeout');
      },
    };
    await expect(
      new InvitationDesignsService(prisma as never, provider as never).generateWithAi(
        'owner-1',
        invitationId,
        { prompt: 'Create a garden invitation' }
      )
    ).rejects.toMatchObject({
      status: 502,
      message: 'AI generation timed out. Please try again.',
    });
    expect(destructive).toEqual([]);
  });

  it('maps provider 5xx failures to a safe retryable error without raw details', async () => {
    const prisma = {
      invitation: {
        findFirst: async () => ({ id: invitationId, event, designs: [] }),
      },
      aiUsage: { create: async () => ({ id: 'usage-failed' }) },
    };
    const provider = {
      generateDesign: async () => {
        throw new InvitationAiProviderError('upstream 500: stack trace here', 'provider');
      },
    };
    const error = await new InvitationDesignsService(prisma as never, provider as never)
      .generateWithAi('owner-1', invitationId, { prompt: 'Create a garden invitation' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BadGatewayException);
    expect(String((error as Error).message)).toBe('AI generation failed. Please try again.');
    expect(String((error as Error).message)).not.toContain('stack trace');
  });

  it('treats a missing API key as unavailable AI without touching stored data', async () => {
    const destructive: string[] = [];
    const fail = () => {
      destructive.push('called');
      throw new Error('must not write on missing key');
    };
    const prisma = {
      invitation: {
        findFirst: async () => ({ id: invitationId, event, designs: [] }),
      },
      invitationDesign: { updateMany: fail, create: fail },
      aiUsage: { create: async () => ({ id: 'usage-failed' }) },
    };
    await expect(
      new InvitationDesignsService(prisma as never).generateWithAi('owner-1', invitationId, {
        prompt: 'Create a garden invitation',
      })
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(destructive).toEqual([]);
  });

  it('supports retry after a failure and persists the design on success', async () => {
    const writes: unknown[] = [];
    let attempts = 0;
    const prisma = {
      invitation: {
        findFirst: async () => ({ id: invitationId, event, designs: [] }),
      },
      invitationDesign: {
        updateMany: async () => ({ count: 0 }),
        create: async (args: { data: unknown }) => {
          writes.push(args);
          return { ...designRecord, version: 1, sourceType: 'AI_GENERATED' };
        },
      },
      aiUsage: { create: async () => ({ id: 'usage-1' }) },
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    };
    const provider = {
      generateDesign: async () => {
        attempts += 1;
        if (attempts === 1) throw new InvitationAiProviderError('boom', 'provider');
        return { provider: 'test', model: 'test-model', tokensUsed: 10, specification };
      },
    };
    const service = new InvitationDesignsService(prisma as never, provider as never);
    await expect(
      service.generateWithAi('owner-1', invitationId, { prompt: 'Create a garden invitation' })
    ).rejects.toBeInstanceOf(BadGatewayException);
    const result = await service.generateWithAi('owner-1', invitationId, {
      prompt: 'Create a garden invitation',
    });
    expect(attempts).toBe(2);
    expect(result).toMatchObject({ version: 1, sourceType: 'AI_GENERATED' });
    expect(writes).toHaveLength(1);
  });

  it('rejects generation for another user invitation before calling the provider', async () => {
    let providerCalls = 0;
    const prisma = {
      invitation: { findFirst: async () => null },
    };
    const provider = {
      generateDesign: async () => {
        providerCalls += 1;
        return { provider: 'test', model: 'test-model', specification };
      },
    };
    await expect(
      new InvitationDesignsService(prisma as never, provider as never).generateWithAi(
        'intruder',
        invitationId,
        { prompt: 'Create a garden invitation' }
      )
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(providerCalls).toBe(0);
  });
});
