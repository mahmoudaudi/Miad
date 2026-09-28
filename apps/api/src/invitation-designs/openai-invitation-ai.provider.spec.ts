import { AiGenerationCancelledError, InvitationAiProviderError } from './ai-provider.types';
import { Logger } from '@nestjs/common';
import { OpenRouterInvitationAiProvider } from './openai-invitation-ai.provider';
import { HtmlArtifactValidationError } from './html-artifact';

const config = (values: Record<string, unknown>) =>
  ({ get: (key: string) => ({ AI_STRICT_DESIGN_VALIDATION: true, ...values })[key] }) as never;
const event = {
  title: 'Garden Dinner',
  eventType: 'Dinner',
  description: 'A garden evening',
  eventDate: '2026-12-12',
  startTime: '18:30',
  endTime: '22:00',
  venueName: 'The Garden Room',
  venueAddress: null,
};
const projectOutput = {
  project: {
    name: 'Garden Dinner',
    description: 'An elegant evening among the garden.',
    files: [
      { path: 'index.html' as const, content: '<main class="card"><h1>Garden Dinner</h1></main>' },
      { path: 'styles.css' as const, content: 'body{margin:0;background:#fff}h1{font-size:3rem}' },
    ],
  },
};
/** A project envelope cut off mid-object, exactly as a truncated reply looks. */
const TRUNCATED_JSON = '{"project":{"name":"Trunc';
const response = (value: unknown, tokens = 456) =>
  new Response(
    JSON.stringify({
      choices: [{ message: { content: JSON.stringify(value) } }],
      usage: { total_tokens: tokens },
    }),
    { status: 200 }
  );

describe('OpenRouterInvitationAiProvider', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('uses OpenRouter chat completions and never sends its key in the request body', async () => {
    let request: { url: string; init: RequestInit } | undefined;
    global.fetch = jest.fn(async (url: string, init: RequestInit) => {
      request = { url, init };
      return response(projectOutput, 789);
    }) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({
        OPENROUTER_API_KEY: 'router-secret',
        OPENROUTER_MODEL: 'deepseek/deepseek-v4.1-flash',
        OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
      })
    );
    const result = await provider.generateHtml({
      prompt: 'Create a calm garden dinner invitation',
      event,
    });
    expect(result).toMatchObject({
      provider: 'openrouter',
      model: 'deepseek/deepseek-v4.1-flash',
      tokensUsed: 789,
      project: projectOutput.project,
      artifact: { title: 'Garden Dinner' },
    });
    expect(request?.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(request?.init.headers).toMatchObject({ Authorization: 'Bearer router-secret' });
    const body = JSON.parse(String(request?.init.body));
    expect(JSON.stringify(body)).not.toContain('router-secret');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages[0].content).toContain('standalone');
    expect(body.messages[0].content).toContain('Never generate RSVP sections, forms, buttons, controls');
    expect(body.messages[0].content).toContain('Never generate countdown timers or countdown displays');
    expect(JSON.parse(body.messages[1].content)).toEqual({
      prompt: 'Create a calm garden dinner invitation',
      event,
    });
  });

  it('accepts a valid direct project by normalizing it to the canonical project structure', async () => {
    global.fetch = jest.fn(async () => response(projectOutput.project)) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret' })
    );

    await expect(
      provider.generateHtml({ prompt: 'Create a garden invitation', event })
    ).resolves.toMatchObject({
      project: projectOutput.project,
      artifact: { title: 'Garden Dinner' },
    });
  });

  it('keeps SaaS RSVP and countdown functionality out of structured design schema and instructions', async () => {
    let systemPrompt = '';
    global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { messages: Array<{ content: string }> };
      systemPrompt = body.messages[0]?.content ?? '';
      return response({ schemaVersion: 1 });
    }) as never;
    const provider = new OpenRouterInvitationAiProvider(config({ OPENROUTER_API_KEY: 'router-secret' }));

    await provider.generateDesign({
      operation: 'generate',
      prompt: 'Create an invitation',
      event,
      currentDesign: null,
    });

    expect(systemPrompt).toContain('"enum":["hero","details","story","schedule","note"]');
    expect(systemPrompt).not.toContain('"rsvp"');
    expect(systemPrompt).toContain('Never generate RSVP sections, forms, buttons');
    expect(systemPrompt).toContain('never generate countdown timers or displays');
  });

  it('accepts alternate renderable output shapes in temporary compatibility mode', async () => {
    global.fetch = jest.fn(async () =>
      response({
        design: {
          title: 'Garden Dinner',
          summary: 'An evening among the flowers',
          body: '<main><h1>Garden Dinner</h1><p>December 12</p></main>',
          styles: '',
        },
      })
    ) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret', AI_STRICT_DESIGN_VALIDATION: false })
    );

    await expect(
      provider.generateHtml({ prompt: 'Create a garden invitation', event })
    ).resolves.toMatchObject({
      artifact: {
        title: 'Garden Dinner',
        body: '<main><h1>Garden Dinner</h1><p>December 12</p></main>',
      },
      project: {
        files: [
          { path: 'index.html', content: expect.stringContaining('Garden Dinner') },
          { path: 'styles.css', content: 'body{margin:0;font-family:serif}' },
        ],
      },
    });
  });

  it('still rejects empty, malformed, and dangerous output in compatibility mode', async () => {
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret', AI_STRICT_DESIGN_VALIDATION: false })
    );
    for (const output of [{ project: {} }, { project: { html: '   ' } }]) {
      global.fetch = jest.fn(async () => response(output)) as never;
      await expect(
        provider.generateHtml({ prompt: 'Create a garden invitation', event })
      ).rejects.toMatchObject({ status: 'invalid-output' });
    }
    global.fetch = jest.fn(async () =>
      response({ project: { html: '<main><script>alert(1)</script></main>' } })
    ) as never;
    await expect(
      provider.generateHtml({ prompt: 'Create a garden invitation', event })
    ).rejects.toMatchObject({ status: 'invalid-output' });
  });

  it('accepts a project that carries extra model keys and drops them', async () => {
    global.fetch = jest.fn(async () =>
      response({ project: { ...projectOutput.project, extra: 'ignored', notes: { a: 1 } } })
    ) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret' })
    );

    // Unknown keys are not an envelope violation and are never persisted.
    await expect(
      provider.generateHtml({ prompt: 'Create a garden invitation', event })
    ).resolves.toMatchObject({ project: projectOutput.project });
  });

  it('accepts file objects that carry extra model keys', async () => {
    global.fetch = jest.fn(async () =>
      response({
        project: {
          ...projectOutput.project,
          files: projectOutput.project.files.map((file) => ({ ...file, language: 'html' })),
        },
      })
    ) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret' })
    );

    const result = await provider.generateHtml({ prompt: 'Create a garden invitation', event });
    expect(result.project.files).toEqual(projectOutput.project.files);
  });

  it('still rejects a project that is missing a required field', async () => {
    const withoutDescription = {
      name: projectOutput.project.name,
      files: projectOutput.project.files,
    };
    global.fetch = jest.fn(async () => response({ project: withoutDescription })) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret' })
    );

    await expect(
      provider.generateHtml({ prompt: 'Create a garden invitation', event })
    ).rejects.toMatchObject({
      status: 'invalid-output',
    } satisfies Partial<InvitationAiProviderError>);
  });

  it('clamps an over-long name or description instead of discarding the website', async () => {
    global.fetch = jest.fn(async () =>
      response({
        project: {
          ...projectOutput.project,
          name: `Garden ${'Dinner '.repeat(40)}`,
          description: 'x'.repeat(500),
        },
      })
    ) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret' })
    );

    const result = await provider.generateHtml({ prompt: 'Create a garden invitation', event });
    expect(result.project.name.length).toBeLessThanOrEqual(120);
    expect(result.project.description.length).toBeLessThanOrEqual(300);
  });

  it('rejects a direct project with missing files', async () => {
    const withoutFiles = {
      name: projectOutput.project.name,
      description: projectOutput.project.description,
    };
    global.fetch = jest.fn(async () => response(withoutFiles)) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret' })
    );

    await expect(
      provider.generateHtml({ prompt: 'Create a garden invitation', event })
    ).rejects.toMatchObject({
      status: 'invalid-output',
    } satisfies Partial<InvitationAiProviderError>);
  });

  it('rejects direct projects with invalid file paths', async () => {
    global.fetch = jest.fn(async () =>
      response({
        ...projectOutput.project,
        files: [
          { ...projectOutput.project.files[0], path: '../index.html' },
          projectOutput.project.files[1],
        ],
      })
    ) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret' })
    );

    await expect(
      provider.generateHtml({ prompt: 'Create a garden invitation', event })
    ).rejects.toMatchObject({
      status: 'invalid-output',
    } satisfies Partial<InvitationAiProviderError>);
  });

  it('rejects direct projects containing unsafe source', async () => {
    global.fetch = jest.fn(async () =>
      response({
        ...projectOutput.project,
        files: [
          { ...projectOutput.project.files[0], content: '<main><script>alert(1)</script></main>' },
          projectOutput.project.files[1],
        ],
      })
    ) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret' })
    );

    await expect(
      provider.generateHtml({ prompt: 'Create a garden invitation', event })
    ).rejects.toMatchObject({
      status: 'invalid-output',
    } satisfies Partial<InvitationAiProviderError>);
  });

  it('passes the active project to a refinement request', async () => {
    let body: { messages: Array<{ content: string }> } | undefined;
    global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return response(projectOutput);
    }) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret' })
    );
    await provider.refineHtml({
      prompt: 'Make it more elegant.',
      event,
      project: projectOutput.project,
    });
    expect(JSON.parse(body!.messages[1]!.content)).toMatchObject({
      prompt: 'Make it more elegant.',
      currentProject: projectOutput.project,
    });
  });

  it('maps missing credentials and timeouts to safe provider errors', async () => {
    const missing = new OpenRouterInvitationAiProvider(config({ OPENROUTER_API_KEY: '' }));
    await expect(
      missing.generateHtml({ prompt: 'Create a garden invitation', event })
    ).rejects.toMatchObject({ status: 'configuration' });
    global.fetch = jest.fn(async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    }) as never;
    const timedOut = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret', AI_PROVIDER_TIMEOUT_MS: 1 })
    );
    const stages: string[] = [];
    await expect(
      timedOut.generateHtml({
        prompt: 'Create a garden invitation',
        event,
        onProgress: (stage) => stages.push(stage),
      })
    ).rejects.toMatchObject({ status: 'timeout' } satisfies Partial<InvitationAiProviderError>);
    // The caller remains at GENERATING_WEBSITE until a response exists.
    expect(stages).toEqual([]);
  });

  it('emits parsing and validation only after a provider response arrives', async () => {
    global.fetch = jest.fn(async () => response(projectOutput)) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret' })
    );
    const stages: string[] = [];

    await provider.generateHtml({
      prompt: 'Create a garden invitation',
      event,
      onProgress: (stage) => stages.push(stage),
    });

    expect(stages).toEqual(['PARSING_RESPONSE', 'VALIDATING_WEBSITE']);
  });

  it('keeps an invalid project at the validation stage', async () => {
    global.fetch = jest.fn(async () =>
      response({ project: { name: 'Broken', description: 'Broken output', files: [] } })
    ) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret' })
    );
    const stages: string[] = [];

    await expect(
      provider.generateHtml({
        prompt: 'Create a garden invitation',
        event,
        onProgress: (stage) => stages.push(stage),
      })
    ).rejects.toMatchObject({
      status: 'invalid-output',
    } satisfies Partial<InvitationAiProviderError>);
    expect(stages).toEqual([
      'PARSING_RESPONSE',
      'VALIDATING_WEBSITE',
      'PARSING_RESPONSE',
      'VALIDATING_WEBSITE',
      'PARSING_RESPONSE',
      'VALIDATING_WEBSITE',
    ]);
  });

  it('keeps malformed model JSON at the parsing stage', async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{invalid json' } }],
          }),
          { status: 200 }
        )
    ) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret' })
    );
    const stages: string[] = [];

    await expect(
      provider.generateHtml({
        prompt: 'Create a garden invitation',
        event,
        onProgress: (stage) => stages.push(stage),
      })
    ).rejects.toMatchObject({
      status: 'invalid-output',
    } satisfies Partial<InvitationAiProviderError>);
    expect(stages).toEqual(['PARSING_RESPONSE', 'PARSING_RESPONSE', 'PARSING_RESPONSE']);
  });

  it('extracts event details from structured output', async () => {
    const details = {
      title: 'Lina Birthday',
      eventType: 'Birthday',
      eventDate: null,
      venueName: 'Rose Garden',
    };
    global.fetch = jest.fn(async () => response(details)) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret' })
    );
    await expect(
      provider.extractEventDetails('A birthday for Lina at Rose Garden')
    ).resolves.toEqual(details);
  });

  it('sends a completion budget large enough for reasoning plus the full project', async () => {
    let body: { max_tokens: number } | undefined;
    global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      body = JSON.parse(String(init.body));
      return response(projectOutput);
    }) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret' })
    );
    await provider.generateHtml({ prompt: 'Create a garden invitation', event });
    // A truncated JSON envelope is unparseable, so the budget must comfortably
    // exceed what the model spends on reasoning plus the project source.
    expect(body?.max_tokens).toBeGreaterThanOrEqual(32_000);
  });

  it('fails safely and distinctly when the provider truncates the answer', async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: TRUNCATED_JSON }, finish_reason: 'length' }],
          }),
          { status: 200 }
        )
    ) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret' })
    );
    await expect(
      provider.generateHtml({ prompt: 'Create a garden invitation', event })
    ).rejects.toMatchObject({
      status: 'invalid-output',
    } satisfies Partial<InvitationAiProviderError>);
  });

  it('recovers JSON wrapped in a preamble and trailing text', async () => {
    const payload = JSON.stringify(projectOutput);
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    'Here is the invitation project you requested:\n\n```json\n' +
                    payload +
                    '\n```\n\nLet me know if you want changes.',
                },
              },
            ],
          }),
          { status: 200 }
        )
    ) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret' })
    );
    await expect(
      provider.generateHtml({ prompt: 'Create a garden invitation', event })
    ).resolves.toMatchObject({ project: projectOutput.project });
  });

  it('still fails safely on genuinely malformed JSON', async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: 'not json at all' } }] }), {
          status: 200,
        })
    ) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret' })
    );
    await expect(
      provider.generateHtml({ prompt: 'Create a garden invitation', event })
    ).rejects.toMatchObject({
      status: 'invalid-output',
    } satisfies Partial<InvitationAiProviderError>);
  });

  it('bounds every website generation provider attempt by the configured timeout', async () => {
    jest.useFakeTimers();
    const capturedSignals: Array<AbortSignal | null | undefined> = [];
    global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      capturedSignals.push(init.signal);
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          const error = new Error('aborted');
          error.name = 'AbortError';
          reject(error);
        });
      });
    }) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({
        OPENROUTER_API_KEY: 'router-secret',
        OPENROUTER_MODEL_GENERATION: 'model-primary',
        OPENROUTER_MODEL_GENERATION_FALLBACKS: 'model-primary',
        OPENROUTER_REQUEST_TIMEOUT_MS: 1000,
      })
    );
    const pending = provider.generateHtml({ prompt: 'Create a garden invitation', event });
    const rejection = expect(pending).rejects.toMatchObject({ status: 'timeout' });
    await jest.advanceTimersByTimeAsync(1000);
    expect(capturedSignals).toHaveLength(1);
    expect(capturedSignals[0]?.aborted).toBe(true);
    await rejection;
  });

  it('treats caller cancellation as cancelled, never as a timeout or provider failure', async () => {
    global.fetch = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const onAbort = () => {
            const error = new Error('This operation was aborted');
            error.name = 'AbortError';
            reject(error);
          };
          if (init.signal?.aborted) onAbort();
          else init.signal?.addEventListener('abort', onAbort, { once: true });
        })
    ) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret' })
    );
    const controller = new AbortController();
    const pending = provider.generateHtml({
      prompt: 'Create a garden invitation',
      event,
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(AiGenerationCancelledError);
  });

  it('still bounds event-detail extraction with its explicit short timeout', async () => {
    global.fetch = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const onAbort = () => {
            const error = new Error('This operation was aborted');
            error.name = 'AbortError';
            reject(error);
          };
          if (init.signal?.aborted) onAbort();
          else init.signal?.addEventListener('abort', onAbort, { once: true });
        })
    ) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret', OPENROUTER_EXTRACTION_TIMEOUT_MS: 30 })
    );
    await expect(provider.extractEventDetails('A birthday for Lina')).rejects.toMatchObject({
      status: 'timeout',
    });
  }, 10000);

  it.each([
    [
      'timeout',
      () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      },
    ],
    ['server error', () => new Response('ignored', { status: 503 })],
    ['rate limit', () => new Response('ignored', { status: 429 })],
    ['connection failure', () => Promise.reject(new TypeError('socket closed'))],
  ])('falls back after a recoverable %s', async (_scenario, makeFailure) => {
    const requestedModels: string[] = [];
    global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { model: string };
      requestedModels.push(body.model);
      if (body.model === 'primary') return makeFailure();
      return response(projectOutput);
    }) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({
        OPENROUTER_API_KEY: 'server-secret',
        OPENROUTER_MODEL_GENERATION: 'primary',
        OPENROUTER_MODEL_GENERATION_FALLBACKS: 'fallback',
      })
    );

    await expect(
      provider.generateHtml({ prompt: 'Create a garden invitation', event })
    ).resolves.toMatchObject({
      model: 'fallback',
      project: projectOutput.project,
    });
    expect(requestedModels).toEqual(['primary', 'fallback']);
  });

  it('falls back when a provider returns malformed design output', async () => {
    const requestedModels: string[] = [];
    global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { model: string };
      requestedModels.push(body.model);
      return body.model === 'primary'
        ? response({ project: { name: 'Broken', description: 'Broken', files: [] } })
        : response(projectOutput);
    }) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({
        OPENROUTER_API_KEY: 'server-secret',
        OPENROUTER_MODEL_GENERATION: 'primary',
        OPENROUTER_MODEL_GENERATION_FALLBACKS: 'fallback',
      })
    );

    await expect(
      provider.generateHtml({ prompt: 'Create a garden invitation', event })
    ).resolves.toMatchObject({
      model: 'fallback',
    });
    expect(requestedModels).toEqual(['primary', 'fallback']);
  });

  it('does not fall back for non-recoverable input errors or return provider bodies', async () => {
    let attempts = 0;
    global.fetch = jest.fn(async () => {
      attempts += 1;
      return new Response('sensitive provider details', { status: 400 });
    }) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({
        OPENROUTER_API_KEY: 'server-secret',
        OPENROUTER_MODEL_GENERATION: 'primary',
        OPENROUTER_MODEL_GENERATION_FALLBACKS: 'fallback',
      })
    );

    await expect(
      provider.generateHtml({ prompt: 'Create a garden invitation', event })
    ).rejects.toMatchObject({
      status: 'input',
      message: 'AI provider request failed.',
    });
    expect(attempts).toBe(1);
  });

  it('classifies HTTP 402 as a payment issue without leaking details or retrying models', async () => {
    const attempts: string[] = [];
    global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      attempts.push((JSON.parse(String(init.body)) as { model: string }).model);
      return new Response('sensitive payment response details', { status: 402 });
    }) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({
        OPENROUTER_API_KEY: 'server-secret',
        OPENROUTER_MODEL_REFINEMENT: 'primary',
        OPENROUTER_MODEL_REFINEMENT_FALLBACKS: 'fallback-one,fallback-two',
      })
    );

    await expect(
      provider.refineHtml({ prompt: 'Make it elegant.', event, project: projectOutput.project })
    ).rejects.toMatchObject({ status: 'provider', httpStatus: 402, retryable: false });
    expect(attempts).toEqual(['primary']);
  });

  it('logs safe per-attempt diagnostics with invitation identity and fallback state', async () => {
    const debug = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      const model = (JSON.parse(String(init.body)) as { model: string }).model;
      return model === 'primary'
        ? new Response('ignored', { status: 503 })
        : response(projectOutput);
    }) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({
        NODE_ENV: 'development',
        OPENROUTER_API_KEY: 'server-secret',
        OPENROUTER_MODEL_REFINEMENT: 'primary',
        OPENROUTER_MODEL_REFINEMENT_FALLBACKS: 'fallback',
      })
    );

    await provider.refineHtml({
      invitationId: 'diagnostic-invitation-id',
      prompt: 'Private invitation change request',
      event,
      project: projectOutput.project,
    });

    const attempts = debug.mock.calls
      .map(([metadata]) => metadata)
      .filter(
        (metadata): metadata is Record<string, unknown> =>
          Boolean(metadata) &&
          typeof metadata === 'object' &&
          (metadata as Record<string, unknown>).event === 'model-route-attempt'
      );
    expect(attempts).toEqual([
      expect.objectContaining({
        invitationId: 'diagnostic-invitation-id',
        operation: 'website-refinement',
        attempt: 1,
        model: 'primary',
        stage: 'provider-request',
        failureCategory: 'provider',
        httpStatus: 503,
        fallbackUsed: false,
        fallbackTriggered: true,
      }),
      expect.objectContaining({
        invitationId: 'diagnostic-invitation-id',
        operation: 'website-refinement',
        attempt: 2,
        model: 'fallback',
        fallbackUsed: true,
        fallbackTriggered: false,
        failureCategory: 'none',
      }),
    ]);
    expect(JSON.stringify(attempts)).not.toContain('Private invitation change request');
    expect(JSON.stringify(attempts)).not.toContain('server-secret');
    debug.mockRestore();
  });

  it('returns a clean error after every configured model fails', async () => {
    const requestedModels: string[] = [];
    global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { model: string };
      requestedModels.push(body.model);
      return new Response('provider raw body should not escape', { status: 503 });
    }) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({
        OPENROUTER_API_KEY: 'server-secret',
        OPENROUTER_MODEL_GENERATION: 'primary',
        OPENROUTER_MODEL_GENERATION_FALLBACKS: 'fallback-one,fallback-two',
      })
    );
    let message = '';
    try {
      await provider.generateHtml({ prompt: 'Create a garden invitation', event });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(requestedModels).toEqual(['primary', 'fallback-one', 'fallback-two']);
    expect(message).toBe('AI provider request failed.');
    expect(message).not.toContain('provider raw body');
  });

  it('uses separately configured models for generation and refinement', async () => {
    const requestedModels: string[] = [];
    global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { model: string };
      requestedModels.push(body.model);
      return response(projectOutput);
    }) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({
        OPENROUTER_API_KEY: 'server-secret',
        OPENROUTER_MODEL_GENERATION: 'generation-model',
        OPENROUTER_MODEL_GENERATION_FALLBACKS: 'generation-fallback',
        OPENROUTER_MODEL_REFINEMENT: 'refinement-model',
        OPENROUTER_MODEL_REFINEMENT_FALLBACKS: 'refinement-fallback',
      })
    );
    await provider.generateHtml({ prompt: 'Create a garden invitation', event });
    await provider.refineHtml({
      prompt: 'Make it elegant',
      event,
      project: projectOutput.project,
    });
    expect(requestedModels).toEqual(['generation-model', 'refinement-model']);
  });

  it('runs the configured refinement fallback chain and retains refinement context', async () => {
    const requestedModels: string[] = [];
    let refinementRequest: { messages: Array<{ role: string; content: string }> } | undefined;
    global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as {
        model: string;
        messages: Array<{ role: string; content: string }>;
      };
      requestedModels.push(body.model);
      refinementRequest = body;
      if (body.model !== 'qwen/qwen3-coder-next')
        return new Response('unavailable', { status: 503 });
      return response(projectOutput);
    }) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({
        OPENROUTER_API_KEY: 'server-secret',
        OPENROUTER_MODEL_REFINEMENT: 'google/gemini-3.8-flash',
        OPENROUTER_MODEL_REFINEMENT_FALLBACKS: 'deepseek/deepseek-v4.1-flash,qwen/qwen3-coder-next',
      })
    );

    await expect(
      provider.refineHtml({
        invitationId: 'invitation-diagnostic-id',
        prompt: 'Change the colors to navy and gold.',
        event,
        project: projectOutput.project,
      })
    ).resolves.toMatchObject({ model: 'qwen/qwen3-coder-next' });
    expect(requestedModels).toEqual([
      'google/gemini-3.8-flash',
      'deepseek/deepseek-v4.1-flash',
      'qwen/qwen3-coder-next',
    ]);
    expect(refinementRequest?.messages[0]?.content).toContain(
      'Modify the supplied currentProject to fulfill the refinement prompt'
    );
    expect(JSON.parse(refinementRequest!.messages[1]!.content)).toMatchObject({
      prompt: 'Change the colors to navy and gold.',
      event,
      currentProject: projectOutput.project,
    });
    expect(refinementRequest!.messages[1]!.content).not.toContain('invitation-diagnostic-id');
  });

  it('runs an approved manual model first and then a compatible configured fallback', async () => {
    const requestedModels: string[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/models/user')) {
        return new Response(
          JSON.stringify({
            data: [
              'anthropic/claude-opus-5.5',
              'google/gemini-3.8-flash',
              'deepseek/deepseek-v4.1-flash',
              'qwen/qwen3-coder-next',
            ].map((id) => ({ id })),
          }),
          { status: 200 }
        );
      }
      requestedModels.push((JSON.parse(String(init?.body)) as { model: string }).model);
      return requestedModels.length === 1
        ? new Response('', { status: 503 })
        : response(projectOutput);
    }) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret' })
    );

    await expect(
      provider.generateHtml({
        prompt: 'Create a garden invitation',
        event,
        modelPreference: 'anthropic/claude-opus-5.5',
      })
    ).resolves.toMatchObject({ model: 'deepseek/deepseek-v4.1-flash' });
    expect(requestedModels).toEqual(['anthropic/claude-opus-5.5', 'deepseek/deepseek-v4.1-flash']);
  });

  it('does not attempt a fallback after a successful manual model response', async () => {
    const requestedModels: string[] = [];
    global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/models/user')) {
        return new Response(
          JSON.stringify({
            data: [
              'openai/gpt-6-luna',
              'google/gemini-3.8-flash',
              'deepseek/deepseek-v4.1-flash',
              'qwen/qwen3-coder-next',
            ].map((id) => ({ id })),
          }),
          { status: 200 }
        );
      }
      requestedModels.push((JSON.parse(String(init?.body)) as { model: string }).model);
      return response(projectOutput);
    }) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret' })
    );

    await provider.generateHtml({
      prompt: 'Create a garden invitation',
      event,
      modelPreference: 'openai/gpt-6-luna',
    });
    expect(requestedModels).toEqual(['openai/gpt-6-luna']);
  });

  it('does not retry output rejected by the security validator', async () => {
    const requestedModels: string[] = [];
    global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      requestedModels.push((JSON.parse(String(init.body)) as { model: string }).model);
      return response(projectOutput);
    }) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret' })
    );

    await expect(
      provider.refineHtml({
        prompt: 'Make the invitation more elegant',
        event,
        project: projectOutput.project,
        validateArtifact: () => {
          throw new HtmlArtifactValidationError(
            'css',
            'security',
            'css-forbidden-value',
            16,
            'css'
          );
        },
      })
    ).rejects.toMatchObject({ status: 'invalid-output', retryable: false });
    expect(requestedModels).toEqual(['google/gemini-3.8-flash']);
  });

  it('falls back from malformed refinement output without weakening validation', async () => {
    const requestedModels: string[] = [];
    global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { model: string };
      requestedModels.push(body.model);
      return body.model === 'google/gemini-3.8-flash'
        ? response({ project: { name: 'Broken', description: 'No files', files: [] } })
        : response(projectOutput);
    }) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({
        OPENROUTER_API_KEY: 'server-secret',
        OPENROUTER_MODEL_REFINEMENT: 'google/gemini-3.8-flash',
        OPENROUTER_MODEL_REFINEMENT_FALLBACKS: 'deepseek/deepseek-v4.1-flash,qwen/qwen3-coder-next',
      })
    );

    await expect(
      provider.refineHtml({
        prompt: 'Make it navy and gold.',
        event,
        project: projectOutput.project,
      })
    ).resolves.toMatchObject({ model: 'deepseek/deepseek-v4.1-flash' });
    expect(requestedModels).toEqual(['google/gemini-3.8-flash', 'deepseek/deepseek-v4.1-flash']);
  });

  it('uses the configured Smart Questions model for a valid analysis operation', async () => {
    const requestedModels: string[] = [];
    global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { model: string };
      requestedModels.push(body.model);
      return response({ status: 'READY', collectedData: { eventType: 'Dinner' }, question: null });
    }) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({
        OPENROUTER_API_KEY: 'server-secret',
        OPENROUTER_MODEL_SMART_QUESTIONS: 'questions-model',
        OPENROUTER_MODEL_SMART_QUESTIONS_FALLBACKS: 'questions-fallback',
      })
    );

    await expect(
      provider.analyzeDetails({ prompt: 'Dinner', collectedData: {}, answers: [] })
    ).resolves.toMatchObject({ status: 'READY' });
    expect(requestedModels).toEqual(['questions-model']);
  });

  it('retries structured design validation failures inside the model route', async () => {
    const requestedModels: string[] = [];
    global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { model: string };
      requestedModels.push(body.model);
      return response(body.model === 'primary' ? { incomplete: true } : { schemaVersion: 1 });
    }) as never;
    const provider = new OpenRouterInvitationAiProvider(
      config({
        OPENROUTER_API_KEY: 'server-secret',
        OPENROUTER_MODEL_GENERATION: 'primary',
        OPENROUTER_MODEL_GENERATION_FALLBACKS: 'fallback',
      })
    );

    await expect(
      provider.generateDesign({
        operation: 'generate',
        prompt: 'Make a garden invitation',
        event,
        currentDesign: null,
        validateSpecification: (specification) => {
          if (
            typeof specification !== 'object' ||
            specification === null ||
            !('schemaVersion' in specification)
          )
            throw new Error('invalid structure');
        },
      })
    ).resolves.toMatchObject({ model: 'fallback' });
    expect(requestedModels).toEqual(['primary', 'fallback']);
  });
});
