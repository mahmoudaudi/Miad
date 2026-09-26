import { AiGenerationCancelledError, InvitationAiProviderError } from './ai-provider.types';
import { OpenRouterInvitationAiProvider } from './openai-invitation-ai.provider';

const config = (values: Record<string, unknown>) =>
  ({ get: (key: string) => values[key] }) as never;
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
    expect(stages).toEqual(['PARSING_RESPONSE', 'VALIDATING_WEBSITE']);
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
    expect(stages).toEqual(['PARSING_RESPONSE']);
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
    ).rejects.toMatchObject({ status: 'provider' } satisfies Partial<InvitationAiProviderError>);
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

  it('keeps website generation active past any fixed deadline until the provider responds', async () => {
    jest.useFakeTimers();
    let capturedSignal: AbortSignal | null | undefined;
    let resolveFetch!: (value: Response) => void;
    global.fetch = jest.fn(async (_url: string, init: RequestInit) => {
      capturedSignal = init.signal;
      return new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      });
    }) as never;
    // Even a 1ms configured budget must not cancel website generation: the
    // generation timeout no longer exists.
    const provider = new OpenRouterInvitationAiProvider(
      config({ OPENROUTER_API_KEY: 'router-secret', OPENROUTER_GENERATION_TIMEOUT_MS: 1 })
    );
    const pending = provider.generateHtml({ prompt: 'Create a garden invitation', event });
    await jest.advanceTimersByTimeAsync(300_000);
    expect(capturedSignal?.aborted).toBe(false);
    resolveFetch(response(projectOutput));
    await expect(pending).resolves.toMatchObject({ project: projectOutput.project });
  });

  it('treats caller cancellation as cancelled, never as a timeout or provider failure', async () => {
    global.fetch = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const error = new Error('This operation was aborted');
            error.name = 'AbortError';
            reject(error);
          });
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
});
