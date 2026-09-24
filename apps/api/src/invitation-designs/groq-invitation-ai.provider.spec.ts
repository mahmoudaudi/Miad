import { InvitationAiProviderError } from './ai-provider.types';
import { GroqInvitationAiProvider } from './groq-invitation-ai.provider';

const config = (values: Record<string, unknown>) =>
  ({
    get: (key: string) => values[key],
  }) as never;

const event = {
  title: 'Garden Dinner',
  eventDate: '2026-12-12',
  venueName: 'The Garden Room',
  venueAddress: null,
};

const output = {
  schemaVersion: 1,
  theme: 'classic-ivory',
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
  typography: { headingFamily: 'Playfair Display', bodyFamily: 'Inter' },
  layout: { alignment: 'center', density: 'airy' },
  sections: [
    { id: 'hero', type: 'hero', title: 'Garden Dinner', body: 'You are invited', order: 0, visible: true },
    { id: 'details', type: 'details', title: 'Details', body: 'December 12, 2026', order: 1, visible: true },
    { id: 'rsvp', type: 'rsvp', title: 'RSVP', body: 'Confirm attendance.', order: 2, visible: true },
  ],
  elements: [
    {
      id: 'title', type: 'text', label: 'Title', text: 'Garden Dinner', imageUrl: null,
      x: 12, y: 25, width: 76, height: 20, fontSize: 48, color: '#241C18', backgroundColor: null,
    },
    {
      id: 'details', type: 'section', label: 'Details', text: 'December 12, 2026', imageUrl: null,
      x: 22, y: 58, width: 56, height: 18, fontSize: 16, color: '#241C18', backgroundColor: null,
    },
    {
      id: 'image', type: 'image', label: 'Image', text: null, imageUrl: null,
      x: 66, y: 10, width: 24, height: 28, fontSize: 14, color: '#241C18', backgroundColor: '#FFFDF8',
    },
  ],
};

describe('GroqInvitationAiProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('requests JSON-mode chat output without exposing secrets in the body', async () => {
    type CapturedRequest = { url: string; init: RequestInit };
    let request: CapturedRequest | undefined;
    global.fetch = jest.fn(async (url: string, init: RequestInit) => {
      request = { url, init };
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify(output) } }],
          usage: { total_tokens: 789 },
        }),
        { status: 200 }
      );
    }) as never;

    const provider = new GroqInvitationAiProvider(
      config({
        GROQ_API_KEY: 'gsk-test',
        GROQ_MODEL: 'openai/gpt-oss-120b',
        GROQ_BASE_URL: 'https://api.groq.com/openai/v1',
        AI_PROVIDER_TIMEOUT_MS: 10_000,
      })
    );
    const result = await provider.generateDesign({
      operation: 'generate',
      prompt: 'Create a garden invitation',
      event,
      currentDesign: null,
    });

    expect(result).toMatchObject({
      provider: 'groq',
      model: 'openai/gpt-oss-120b',
      tokensUsed: 789,
      specification: { content: { title: 'Garden Dinner' } },
    });
    expect(request).toBeDefined();
    const captured = request as CapturedRequest;
    expect(captured.url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(captured.init.headers).toMatchObject({ Authorization: 'Bearer gsk-test' });
    const body = JSON.parse(String(captured.init.body));
    expect(JSON.stringify(body)).not.toContain('gsk-test');
    expect(body.response_format).toMatchObject({ type: 'json_object' });
    expect(JSON.stringify(body.messages)).toContain('Create a garden invitation');
  });

  it('fails fast when the provider key is missing', async () => {
    const provider = new GroqInvitationAiProvider(
      config({ GROQ_API_KEY: '', GROQ_MODEL: 'openai/gpt-oss-120b' })
    );
    await expect(
      provider.generateDesign({
        operation: 'generate',
        prompt: 'Create a garden invitation',
        event,
        currentDesign: null,
      })
    ).rejects.toMatchObject({ status: 'configuration' });
  });

  it('maps empty choices to an invalid-output error', async () => {
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 })) as never;
    const provider = new GroqInvitationAiProvider(
      config({ GROQ_API_KEY: 'gsk-test', GROQ_MODEL: 'openai/gpt-oss-120b' })
    );
    await expect(
      provider.generateDesign({
        operation: 'generate',
        prompt: 'Create a garden invitation',
        event,
        currentDesign: null,
      })
    ).rejects.toBeInstanceOf(InvitationAiProviderError);
  });

  it('maps provider timeouts to a timeout error', async () => {
    global.fetch = jest.fn(async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    }) as never;
    const provider = new GroqInvitationAiProvider(
      config({ GROQ_API_KEY: 'gsk-test', GROQ_MODEL: 'openai/gpt-oss-120b', AI_PROVIDER_TIMEOUT_MS: 1 })
    );
    await expect(
      provider.generateDesign({
        operation: 'refine',
        prompt: 'Make it warmer',
        event,
        currentDesign: output as never,
      })
    ).rejects.toMatchObject({ status: 'timeout' });
  });

  it('maps provider 5xx to a provider error without leaking the body', async () => {
    global.fetch = jest.fn(
      async () => new Response('upstream exploded', { status: 500 })
    ) as never;
    const provider = new GroqInvitationAiProvider(
      config({ GROQ_API_KEY: 'gsk-test', GROQ_MODEL: 'openai/gpt-oss-120b' })
    );
    const error = await provider
      .generateDesign({
        operation: 'generate',
        prompt: 'Create a garden invitation',
        event,
        currentDesign: null,
      })
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 'provider' });
    expect(String((error as Error).message)).not.toContain('exploded');
  });
});
