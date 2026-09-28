import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { AiModelRoutingService } from './ai-model-routing.service';

const config = (values: Record<string, unknown>) =>
  ({ get: (key: string) => values[key] }) as never;

const accountModels = [
  'deepseek/deepseek-v4.1-flash',
  'google/gemini-3.8-flash',
  'google/gemini-3.5-flash-lite',
  'qwen/qwen3-coder-next',
  'anthropic/claude-opus-5.5',
  'openai/gpt-6-luna',
  'mistralai/mistral-large',
].map((id) => ({ id }));

describe('AiModelRoutingService model preferences', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('keeps Auto on the operation-specific configured route without a catalog lookup', async () => {
    const fetch = jest.fn();
    global.fetch = fetch as never;
    const routing = new AiModelRoutingService(
      config({
        OPENROUTER_MODEL_REFINEMENT: 'primary',
        OPENROUTER_MODEL_REFINEMENT_FALLBACKS: 'backup',
      })
    );

    await expect(routing.candidatesForPreference('refinement', 'auto')).resolves.toEqual([
      'primary',
      'backup',
    ]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('starts a manual route with the approved model and keeps compatible automatic fallbacks', async () => {
    global.fetch = jest.fn(
      async () => new Response(JSON.stringify({ data: accountModels }), { status: 200 })
    ) as never;
    const routing = new AiModelRoutingService(config({ OPENROUTER_API_KEY: 'test-only' }));

    await expect(
      routing.candidatesForPreference('refinement', 'anthropic/claude-opus-5.5')
    ).resolves.toEqual([
      'anthropic/claude-opus-5.5',
      'google/gemini-3.8-flash',
      'deepseek/deepseek-v4.1-flash',
      'qwen/qwen3-coder-next',
    ]);
  });

  it('rejects unknown and operation-incompatible model IDs', async () => {
    const fetch = jest.fn();
    global.fetch = fetch as never;
    const routing = new AiModelRoutingService(config({ OPENROUTER_API_KEY: 'test-only' }));

    await expect(
      routing.candidatesForPreference('generation', 'provider/arbitrary-model')
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      routing.candidatesForPreference('image-planning', 'qwen/qwen3-coder-next')
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('uses compatible available fallbacks if an approved selected model has become unavailable', async () => {
    global.fetch = jest.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: [{ id: 'google/gemini-3.8-flash' }, { id: 'qwen/qwen3-coder-next' }],
          }),
          { status: 200 }
        )
    ) as never;
    const routing = new AiModelRoutingService(config({ OPENROUTER_API_KEY: 'test-only' }));

    await expect(
      routing.candidatesForPreference('refinement', 'anthropic/claude-opus-5.5')
    ).resolves.toEqual(['google/gemini-3.8-flash', 'qwen/qwen3-coder-next']);
  });

  it('exposes only the five approved models and marks account availability', async () => {
    global.fetch = jest.fn(
      async () => new Response(JSON.stringify({ data: accountModels }), { status: 200 })
    ) as never;
    const routing = new AiModelRoutingService(config({ OPENROUTER_API_KEY: 'test-only' }));
    const result = await routing.modelOptions();

    expect(result.models.map(({ id }) => id)).toEqual([
      'deepseek/deepseek-v4.1-flash',
      'qwen/qwen3-coder-next',
      'anthropic/claude-opus-5.5',
      'openai/gpt-6-luna',
      'mistralai/mistral-large',
    ]);
    expect(result.models.every((model) => model.available)).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/api.?key|authorization/i);
  });

  it('fails closed when account availability cannot be verified', async () => {
    global.fetch = jest.fn(async () => new Response('', { status: 503 })) as never;
    const routing = new AiModelRoutingService(config({ OPENROUTER_API_KEY: 'test-only' }));

    await expect(routing.modelOptions()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
