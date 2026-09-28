import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InvitationAiProviderError, AiGenerationCancelledError } from './ai-provider.types';
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
            id: invitationId,
            publishedDesignVersion: 1,
            event,
          };
        },
      },
      invitationDesign: {
        findFirst: async (args: unknown) => {
          expect(args).toMatchObject({
            where: { invitationId, version: 1 },
            select: { designSpecification: true },
          });
          return { designSpecification: specification };
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
        id: true,
        publishedDesignVersion: true,
        event: { select: { title: true } },
      },
    });
    expect(result).toHaveProperty('designSpecification');
    if (!('designSpecification' in result)) throw new Error('Expected a legacy design response.');
    expect(result.designSpecification).toMatchObject(specification);
    expect(result.designSpecification.sections).toHaveLength(3);
    expect(result.designSpecification.sections).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'rsvp' })])
    );
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
        create: async (args: {
          data: { designSpecification: unknown; sourceType: unknown };
        }) => {
          calls.push(args);
          return {
            ...designRecord,
            version: 2,
            sourceType: args.data.sourceType,
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

  it('normalizes alternative renderable design shapes when strict validation is disabled', () => {
    const service = new InvitationDesignsService({} as never);
    const normalize = (
      service as unknown as {
        normalizeGeneratedSpecification: (
          value: unknown,
          event: {
            title: string;
            eventType: string;
            description: string | null;
            eventDate: Date;
            startTime: Date | null;
            endTime: Date | null;
            venueName: string | null;
            venueAddress: string | null;
          }
        ) => unknown;
      }
    ).normalizeGeneratedSpecification;
    expect(
      normalize.call(
        service,
        { design: { title: 'Garden Dinner', sections: [{ heading: 'Welcome', text: 'Join us' }] } },
        event
      )
    ).toMatchObject({
      content: { title: 'Garden Dinner' },
      sections: [{ title: 'Welcome', body: 'Join us' }],
    });
    expect(normalize.call(service, { headline: 'A garden evening' }, event)).toMatchObject({
      content: { title: 'A garden evening' },
    });
  });

  it('rejects empty and executable structured output in compatibility mode', () => {
    const service = new InvitationDesignsService({} as never);
    const normalize = (
      service as unknown as {
        normalizeGeneratedSpecification: (
          value: unknown,
          event: {
            title: string;
            eventType: string;
            description: string | null;
            eventDate: Date;
            startTime: Date | null;
            endTime: Date | null;
            venueName: string | null;
            venueAddress: string | null;
          }
        ) => unknown;
      }
    ).normalizeGeneratedSpecification;
    expect(() => normalize.call(service, {}, event)).toThrow(
      'AI provider returned invalid output.'
    );
    expect(() => normalize.call(service, { title: '<script>alert(1)</script>' }, event)).toThrow(
      'AI provider returned invalid output.'
    );
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
            sourceType: args.data.sourceType,
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
    const stitch = {
      generateHtml: async (input: Record<string, unknown>) => {
        providerInput = input;
        return {
          title: 'Garden Dinner',
          description: 'A calm evening among the garden',
          body: '<main class="card"><h1>Garden Dinner</h1><script>alert(1)</script></main>',
          css: 'body{background:url(https://tracker.example);color:#123}.card{display:grid}',
        };
      },
    };

    const result = await new InvitationDesignsService(
      prisma as never,
      undefined,
      undefined,
      stitch as never
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
      onProgress: expect.any(Function),
      signal: undefined,
    });
    expect(providerInput).not.toHaveProperty('currentDesign');
    expect(providerInput).not.toHaveProperty('specification');
    expect(calls[1]).toMatchObject({
      data: {
        invitationId,
        version: 2,
        sourceType: 'STITCH_GENERATED',
        designSpecification: {
          format: 'html',
          version: 1,
          body: '<main class="card"><h1>Garden Dinner</h1></main>',
          css: 'body{color:#123}.card{display:grid}',
        },
      },
    });
    expect(calls[2]).toMatchObject({
      data: {
        operationType: 'GENERATE_DESIGN',
        status: 'SUCCEEDED',
        tokensUsed: expect.any(Number),
      },
    });
    expect(result).toMatchObject({
      version: 2,
      sourceType: 'STITCH_GENERATED',
      artifact: { format: 'html', version: 1 },
    });
    expect(result).not.toHaveProperty('designSpecification');
  });

  it('saves a renderable AI design when compatibility sanitization filters all CSS', async () => {
    const persisted: unknown[] = [];
    const prisma = {
      invitation: {
        findFirst: async () => ({ id: invitationId, event, designs: [{ version: 1 }] }),
      },
      invitationDesign: {
        updateMany: async (args: unknown) => {
          persisted.push(args);
          return { count: 1 };
        },
        create: async (args: { data: { designSpecification: unknown } }) => {
          persisted.push(args);
          return {
            ...designRecord,
            version: 2,
            sourceType: 'AI_GENERATED',
            designSpecification: args.data.designSpecification,
          };
        },
      },
      aiUsage: { create: async () => ({ id: 'usage-compat' }) },
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    };
    const stitch = {
      generateHtml: async () => ({
        title: 'Graduation Celebration',
        description: 'A navy and gold celebration',
        body: '<main><h1>Congratulations, Maya!</h1></main>',
        css: '@import "https://example.test/theme.css";',
      }),
    };

    const result = await new InvitationDesignsService(
      prisma as never,
      undefined,
      undefined,
      stitch as never
    ).generateHtmlWithAi('owner-1', invitationId, 'Create a graduation invitation for Maya');

    expect(result.version).toBe(2);
    expect(result.artifact.body).toContain('Congratulations, Maya!');
    expect(result.artifact.css).toBe('body{margin:0;font-family:serif}');
    expect(persisted[1]).toMatchObject({
      data: {
        version: 2,
        designSpecification: { body: '<main><h1>Congratulations, Maya!</h1></main>' },
      },
    });
  });

  it('refines a saved HTML design into the next validated version and preserves the previous row', async () => {
    const original = {
      format: 'html',
      version: 1,
      title: 'Garden Dinner',
      description: 'A calm evening',
      body: '<main><h1>Garden Dinner</h1></main>',
      css: 'body{color:#123}',
    };
    const rows: Array<{ version: number; isActive: boolean; designSpecification: unknown }> = [
      { version: 4, isActive: true, designSpecification: original },
    ];
    let providerInput: unknown;
    const updateInvitation = jest.fn();
    const prisma = {
      invitation: {
        findFirst: async () => ({
          id: invitationId,
          publishedDesignVersion: 1,
          event,
          designs: [{ ...designRecord, version: 4, designSpecification: original }],
        }),
        update: updateInvitation,
      },
      invitationDesign: {
        updateMany: async () => {
          for (const row of rows) row.isActive = false;
          return { count: 1 };
        },
        create: async (args: { data: Record<string, unknown> }) => {
          const row = {
            version: args.data.version as number,
            isActive: args.data.isActive as boolean,
            designSpecification: args.data.designSpecification,
            sourceType: args.data.sourceType as string,
          };
          rows.push(row);
          return { ...designRecord, id: 'design-5', ...row };
        },
      },
      aiUsage: { create: async () => ({ id: 'usage-1' }) },
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    };
    const provider = {
      refineHtml: async (input: unknown) => {
        providerInput = input;
        return {
          artifact: {
            title: 'Emerald Garden Dinner',
            description: 'A calm evening',
            body: '<main><h1>Emerald Garden Dinner</h1><script>alert(1)</script></main>',
            css: 'body{color:#123} .card{background:url(https://tracker.example/pixel)}',
          },
          tokensUsed: 12,
          provider: 'test',
          model: 'test-model',
          project: { name: '', description: '', files: [] },
        };
      },
    };

    const result = await new InvitationDesignsService(
      prisma as never,
      provider as never
    ).refineHtmlWithAi('owner-1', invitationId, 'Make the background emerald green.');

    expect(providerInput).toMatchObject({
      prompt: 'Make the background emerald green.',
      event: { title: 'Garden Dinner', eventDate: '2026-12-12' },
      project: { name: 'Garden Dinner' },
    });
    expect(result).toMatchObject({
      version: 5,
      sourceType: 'AI_EDIT',
      artifact: { title: 'Emerald Garden Dinner' },
    });
    expect(result.artifact.body).not.toContain('<script');
    expect(result.artifact.css).not.toContain('url(');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ version: 4, isActive: false, designSpecification: original });
    expect(rows[1]).toMatchObject({ version: 5, isActive: true });
    expect(updateInvitation).not.toHaveBeenCalled();
  });

  it('uses the owned Stitch screen for edits and persists its returned screen as a new version', async () => {
    const original = {
      format: 'html',
      version: 1,
      title: 'Ahmad & Sara',
      description: 'Luxury romantic wedding',
      body: '<main><h1>Ahmad &amp; Sara</h1><p>June 20, 2027</p></main>',
      css: 'body{color:#765432}',
      stitch: { projectId: 'project-1', screenId: 'design-1' },
    };
    const rows: Array<{ version: number; isActive: boolean; designSpecification: unknown }> = [
      { version: 1, isActive: true, designSpecification: original },
    ];
    const prisma = {
      invitation: {
        findFirst: jest.fn(async () => ({
          id: invitationId,
          event: {
            ...event,
            description: [
              'Original request: Create a wedding invitation for Ahmad and Sara.',
              'Style: Luxury romantic',
              'Colors: Ivory and gold',
              'Date: June 20, 2027',
            ].join('\n'),
          },
          designs: [
            {
              ...designRecord,
              version: rows.at(-1)!.version,
              isActive: rows.at(-1)!.isActive,
              designSpecification: rows.at(-1)!.designSpecification,
            },
          ],
        })),
      },
      invitationDesign: {
        updateMany: jest.fn(async () => {
          for (const row of rows) row.isActive = false;
          return { count: 1 };
        }),
        create: jest.fn(async (args: { data: Record<string, unknown> }) => {
          const row = {
            version: args.data.version as number,
            isActive: args.data.isActive as boolean,
            designSpecification: args.data.designSpecification,
          };
          rows.push(row);
          return { ...designRecord, id: 'design-2', sourceType: 'AI_EDIT', ...row };
        }),
      },
      aiUsage: { create: jest.fn(async () => ({ id: 'usage-1' })) },
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    };
    const provider = { refineHtml: jest.fn() };
    const stitch = {
      editHtml: jest.fn(async (input: { screenId: string }) => ({
        title: 'Ahmad & Sara',
        description: 'Luxury romantic wedding',
        body: '<main><h1>Ahmad &amp; Sara</h1><p>June 20, 2027</p><figure>Large hero</figure></main>',
        css:
          input.screenId === 'design-1'
            ? 'body{color:#765432} h1{font-family:serif}'
            : 'body{color:#800020} h1{font-family:serif}',
        projectId: 'project-1',
        screenId: input.screenId === 'design-1' ? 'design-2' : 'design-3',
      })),
    };

    const service = new InvitationDesignsService(
      prisma as never,
      provider as never,
      undefined,
      stitch as never
    );
    const result = await service.refineHtmlWithAi(
      'owner-1',
      invitationId,
      'Make the typography more elegant and make the hero image larger.'
    );

    expect(stitch.editHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        screenId: 'design-1',
        prompt: 'Make the typography more elegant and make the hero image larger.',
        event: expect.objectContaining({
          description: expect.stringContaining('Ivory and gold'),
        }),
      })
    );
    expect(provider.refineHtml).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      version: 2,
      artifact: { stitch: { projectId: 'project-1', screenId: 'design-2' } },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ version: 1, isActive: false });
    expect(rows[1]).toMatchObject({ version: 2, isActive: true });

    const second = await service.refineHtmlWithAi(
      'owner-1',
      invitationId,
      'Change the palette to burgundy and champagne.'
    );
    expect(stitch.editHtml).toHaveBeenLastCalledWith(
      expect.objectContaining({
        projectId: 'project-1',
        screenId: 'design-2',
        prompt: 'Change the palette to burgundy and champagne.',
        event: expect.objectContaining({ description: expect.stringContaining('June 20, 2027') }),
      })
    );
    expect(second).toMatchObject({
      version: 3,
      artifact: { stitch: { projectId: 'project-1', screenId: 'design-3' } },
    });
    expect(rows).toHaveLength(3);
  });

  it('rejects empty edits and leaves the existing version intact when refinement fails', async () => {
    const original = {
      format: 'html',
      version: 1,
      title: 'Garden Dinner',
      description: 'A calm evening',
      body: '<main><h1>Garden Dinner</h1></main>',
      css: 'body{color:#123}',
    };
    const writes = jest.fn();
    const usage = jest.fn(async () => ({ id: 'usage-failed' }));
    const prisma = {
      invitation: {
        findFirst: async () => ({
          id: invitationId,
          event,
          designs: [{ ...designRecord, designSpecification: original }],
        }),
      },
      invitationDesign: { updateMany: writes, create: writes },
      aiUsage: { create: usage },
    };
    const provider = {
      refineHtml: async () => {
        throw new InvitationAiProviderError('provider timed out', 'timeout');
      },
    };
    const service = new InvitationDesignsService(prisma as never, provider as never);

    await expect(service.refineHtmlWithAi('owner-1', invitationId, '  ')).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(usage).not.toHaveBeenCalled();
    await expect(
      service.refineHtmlWithAi('owner-1', invitationId, 'Make the colors warmer.')
    ).rejects.toMatchObject({
      status: 502,
      message: 'The AI service is temporarily unavailable. Your previous design is safe.',
    });
    expect(writes).not.toHaveBeenCalled();
    expect(usage).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) })
    );
  });

  it('returns a safe preserved-design message for provider payment failures', async () => {
    const original = {
      format: 'html',
      version: 1,
      title: 'Garden Dinner',
      description: 'A calm evening',
      body: '<main><h1>Garden Dinner</h1></main>',
      css: 'body{color:#123}',
    };
    const writes = jest.fn();
    const prisma = {
      invitation: {
        findFirst: async () => ({
          id: invitationId,
          event,
          designs: [{ ...designRecord, designSpecification: original }],
        }),
      },
      invitationDesign: { updateMany: writes, create: writes },
      aiUsage: { create: async () => ({ id: 'usage-failed' }) },
    };
    const provider = {
      refineHtml: async () => {
        throw new InvitationAiProviderError(
          'provider payment response',
          'provider',
          undefined,
          402
        );
      },
    };
    const service = new InvitationDesignsService(prisma as never, provider as never);

    await expect(
      service.refineHtmlWithAi('owner-1', invitationId, 'Change colors to navy and gold.')
    ).rejects.toMatchObject({
      status: 502,
      message:
        'Unable to update the invitation right now. Your previous design is safe. Please try again.',
    });
    expect(writes).not.toHaveBeenCalled();
  });

  it('preserves the active version and published version when the version transaction fails', async () => {
    const original = {
      format: 'html',
      version: 1,
      title: 'Garden Dinner',
      description: 'A calm evening',
      body: '<main><h1>Garden Dinner</h1></main>',
      css: 'body{color:#123}',
    };
    const transaction = jest.fn(async () => {
      throw new Error('database internals must not be exposed');
    });
    const updateMany = jest.fn(async () => ({ count: 1 }));
    const create = jest.fn(async () => ({ ...designRecord, version: 2, isActive: true }));
    const usageCreate = jest.fn(async () => ({ id: 'usage-1' }));
    const findInvitation = jest.fn(async () => ({
      id: invitationId,
      publishedDesignVersion: 1,
      event,
      designs: [{ ...designRecord, version: 1, designSpecification: original }],
    }));
    const prisma = {
      invitation: { findFirst: findInvitation },
      invitationDesign: { updateMany, create },
      aiUsage: { create: usageCreate },
      $transaction: transaction,
    };
    const provider = {
      refineHtml: async () => ({
        artifact: {
          title: 'Navy and Gold Dinner',
          description: 'A calm evening',
          body: '<main><h1>Navy and Gold Dinner</h1></main>',
          css: 'body{color:#123}',
        },
        tokensUsed: 12,
        provider: 'test',
        model: 'test-model',
        project: { name: '', description: '', files: [] },
      }),
    };
    const service = new InvitationDesignsService(prisma as never, provider as never);

    await expect(
      service.refineHtmlWithAi('owner-1', invitationId, 'Change the colors to navy and gold.')
    ).rejects.toBeInstanceOf(InternalServerErrorException);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
    expect(original).toMatchObject({ version: 1, title: 'Garden Dinner' });
    expect(findInvitation).toHaveBeenCalledTimes(1);
    expect(usageCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) })
    );
  });

  it('does not persist or log a failed AI version when refinement is cancelled', async () => {
    const controller = new AbortController();
    const original = {
      format: 'html',
      version: 1,
      title: 'Garden Dinner',
      description: 'A calm evening',
      body: '<main><h1>Garden Dinner</h1></main>',
      css: 'body{color:#123}',
    };
    const writes = jest.fn();
    const usage = jest.fn(async () => ({ id: 'usage-failed' }));
    const prisma = {
      invitation: {
        findFirst: async () => ({
          id: invitationId,
          event,
          designs: [{ ...designRecord, designSpecification: original }],
        }),
      },
      invitationDesign: { updateMany: writes, create: writes },
      aiUsage: { create: usage },
    };
    const provider = {
      refineHtml: async () => {
        controller.abort();
        return {
          artifact: {
            title: 'Updated Garden Dinner',
            description: 'A calm evening',
            body: '<main><h1>Updated Garden Dinner</h1></main>',
            css: 'body{color:#123}',
          },
          tokensUsed: 12,
          provider: 'test',
          model: 'test-model',
          project: { name: '', description: '', files: [] },
        };
      },
    };
    await expect(
      new InvitationDesignsService(prisma as never, provider as never).refineHtmlWithAi(
        'owner-1',
        invitationId,
        'Make the colors warmer.',
        controller.signal
      )
    ).rejects.toBeInstanceOf(AiGenerationCancelledError);
    expect(writes).not.toHaveBeenCalled();
    expect(usage).not.toHaveBeenCalled();
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
        findFirst: async () => ({
          id: invitationId,
          publishedDesignVersion: 1,
          event,
        }),
      },
      invitationDesign: { findFirst: async () => ({ designSpecification: stored }) },
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

  it('skips failure telemetry and persistence when the caller cancels mid-generation', async () => {
    const writes: string[] = [];
    const prisma = {
      invitation: {
        findFirst: async () => ({ id: invitationId, event, designs: [] }),
      },
      invitationDesign: {
        updateMany: async () => {
          writes.push('updateMany');
          return { count: 0 };
        },
        create: async () => {
          writes.push('create');
          return designRecord;
        },
      },
      aiUsage: {
        create: async () => {
          writes.push('aiUsage');
          return { id: 'usage-x' };
        },
      },
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    };
    let capturedSignal: AbortSignal | undefined;
    const stitch = {
      generateHtml: async (input: { signal?: AbortSignal }) => {
        capturedSignal = input.signal;
        throw new AiGenerationCancelledError();
      },
    };
    const controller = new AbortController();
    const error = await new InvitationDesignsService(
      prisma as never,
      undefined,
      undefined,
      stitch as never
    )
      .generateHtmlWithAi(
        'owner-1',
        invitationId,
        'Create a calm garden dinner invitation',
        undefined,
        controller.signal
      )
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AiGenerationCancelledError);
    expect((error as AiGenerationCancelledError).getStatus()).toBe(499);
    expect(capturedSignal).toBe(controller.signal);
    // No FAILED usage row, no design version: cancellation is not a failure.
    expect(writes).toEqual([]);
  });

  it('refuses to persist when cancellation lands after the provider responds', async () => {
    let created = 0;
    const prisma = {
      invitation: {
        findFirst: async () => ({ id: invitationId, event, designs: [] }),
      },
      invitationDesign: {
        updateMany: async () => ({ count: 0 }),
        create: async () => {
          created += 1;
          return designRecord;
        },
      },
      aiUsage: {
        create: async () => ({ id: 'usage-x' }),
      },
      $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
    };
    const stitch = {
      generateHtml: async () => ({
        title: 'Garden Dinner',
        description: 'An elegant evening among the garden.',
        body: '<main><h1>Garden Dinner</h1></main>',
        css: 'body{margin:0}',
      }),
    };
    const controller = new AbortController();
    controller.abort();
    await expect(
      new InvitationDesignsService(
        prisma as never,
        undefined,
        undefined,
        stitch as never
      ).generateHtmlWithAi(
        'owner-1',
        invitationId,
        'Create a calm garden dinner invitation',
        undefined,
        controller.signal
      )
    ).rejects.toBeInstanceOf(AiGenerationCancelledError);
    expect(created).toBe(0);
  });
});
