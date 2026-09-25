import { OpenAIInvitationAiProvider } from './openai-invitation-ai.provider';
import { InvitationAiProviderError } from './ai-provider.types';

const config = (values: Record<string, unknown>) =>
  ({
    get: (key: string) => values[key],
  }) as never;

const event = {
  title: 'Garden Dinner',
  eventType: 'Dinner',
  description: 'A shared garden evening',
  eventDate: '2026-12-12',
  startTime: '18:30',
  endTime: '22:00',
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
    {
      id: 'hero',
      type: 'hero',
      title: 'Garden Dinner',
      body: 'You are invited',
      order: 0,
      visible: true,
    },
    {
      id: 'details',
      type: 'details',
      title: 'Details',
      body: 'December 12, 2026',
      order: 1,
      visible: true,
    },
    {
      id: 'rsvp',
      type: 'rsvp',
      title: 'RSVP',
      body: 'Confirm attendance.',
      order: 2,
      visible: true,
    },
  ],
  elements: [
    {
      id: 'title',
      type: 'text',
      label: 'Title',
      text: 'Garden Dinner',
      imageUrl: null,
      x: 12,
      y: 25,
      width: 76,
      height: 20,
      fontSize: 48,
      color: '#241C18',
      backgroundColor: null,
    },
    {
      id: 'details',
      type: 'section',
      label: 'Details',
      text: 'December 12, 2026',
      imageUrl: null,
      x: 22,
      y: 58,
      width: 56,
      height: 18,
      fontSize: 16,
      color: '#241C18',
      backgroundColor: null,
    },
    {
      id: 'image',
      type: 'image',
      label: 'Image',
      text: null,
      imageUrl: null,
      x: 66,
      y: 10,
      width: 24,
      height: 28,
      fontSize: 14,
      color: '#241C18',
      backgroundColor: '#FFFDF8',
    },
  ],
};

const htmlOutput = {
  title: 'Garden Dinner',
  description: 'An evening among the garden',
  body: '<main class="card"><h1>Garden Dinner</h1></main>',
  css: 'body{margin:0;background:#fff}h1{font-size:3rem}',
};

describe('OpenAIInvitationAiProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('requests strict structured invitation output without exposing secrets in the body', async () => {
    type CapturedRequest = { url: string; init: RequestInit };
    let request: CapturedRequest | undefined;
    global.fetch = jest.fn(async (url: string, init: RequestInit) => {
      request = { url, init };
      return new Response(
        JSON.stringify({
          output_text: JSON.stringify(output),
          usage: { total_tokens: 456 },
        }),
        { status: 200 }
      );
    }) as never;

    const provider = new OpenAIInvitationAiProvider(
      config({
        OPENAI_API_KEY: 'sk-test',
        OPENAI_MODEL: 'gpt-4o-mini',
        OPENAI_BASE_URL: 'https://api.openai.com/v1',
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
      provider: 'openai',
      model: 'gpt-4o-mini',
      tokensUsed: 456,
      specification: { content: { title: 'Garden Dinner' } },
    });
    expect(request).toBeDefined();
    const captured = request as CapturedRequest;
    expect(captured.url).toBe('https://api.openai.com/v1/responses');
    expect(captured.init.headers).toMatchObject({ Authorization: 'Bearer sk-test' });
    const body = JSON.parse(String(captured.init.body));
    expect(JSON.stringify(body)).not.toContain('sk-test');
    expect(body.text.format).toMatchObject({
      type: 'json_schema',
      name: 'invitation_design',
      strict: true,
    });
    expect(body.input[1].content).toContain('Create a garden invitation');
  });

  it('requests standalone HTML from only the prompt and event context', async () => {
    let request: { url: string; init: RequestInit } | undefined;
    global.fetch = jest.fn(async (url: string, init: RequestInit) => {
      request = { url, init };
      return new Response(
        JSON.stringify({ output_text: JSON.stringify(htmlOutput), usage: { total_tokens: 789 } }),
        { status: 200 }
      );
    }) as never;

    const provider = new OpenAIInvitationAiProvider(
      config({
        OPENAI_API_KEY: 'sk-test',
        OPENAI_MODEL: 'gpt-4o-mini',
        OPENAI_BASE_URL: 'https://api.openai.com/v1',
      })
    );
    const result = await provider.generateHtml({
      prompt: 'Create a calm garden dinner invitation',
      event,
    });

    expect(result).toEqual({
      artifact: htmlOutput,
      provider: 'openai',
      model: 'gpt-4o-mini',
      tokensUsed: 789,
    });
    const body = JSON.parse(String(request?.init.body));
    const generationInput = JSON.parse(body.input[1].content);
    expect(generationInput).toEqual({
      prompt: 'Create a calm garden dinner invitation',
      event,
    });
    expect(generationInput).not.toHaveProperty('currentDesign');
    expect(generationInput).not.toHaveProperty('specification');
    expect(body.input[0].content).toContain('224px left workspace sidebar');
    expect(body.text.format).toMatchObject({
      type: 'json_schema',
      name: 'invitation_html',
      strict: true,
    });
  });

  it('fails fast when the provider key is missing', async () => {
    const provider = new OpenAIInvitationAiProvider(
      config({ OPENAI_API_KEY: '', OPENAI_MODEL: 'gpt-4o-mini' })
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

  it('maps provider timeouts to a timeout error', async () => {
    global.fetch = jest.fn(async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    }) as never;
    const provider = new OpenAIInvitationAiProvider(
      config({
        OPENAI_API_KEY: 'sk-test',
        OPENAI_MODEL: 'gpt-4o-mini',
        AI_PROVIDER_TIMEOUT_MS: 1,
      })
    );
    await expect(
      provider.generateDesign({
        operation: 'refine',
        prompt: 'Make it warmer',
        event,
        currentDesign: output as never,
      })
    ).rejects.toBeInstanceOf(InvitationAiProviderError);
    await expect(
      provider.generateDesign({
        operation: 'refine',
        prompt: 'Make it warmer',
        event,
        currentDesign: output as never,
      })
    ).rejects.toMatchObject({ status: 'timeout' });
  });

  it('extracts event details as a plain object', async () => {
    const details = {
      title: 'Lina Birthday',
      eventType: 'Birthday',
      eventDate: null,
      venueName: 'Rose Garden',
    };
    global.fetch = jest.fn(async () => {
      return new Response(JSON.stringify({ output_text: JSON.stringify(details) }), {
        status: 200,
      });
    }) as never;
    const provider = new OpenAIInvitationAiProvider(
      config({ OPENAI_API_KEY: 'sk-test', OPENAI_MODEL: 'gpt-4o-mini' })
    );
    await expect(
      provider.extractEventDetails('A birthday for Lina at Rose Garden')
    ).resolves.toEqual(details);
  });
});
