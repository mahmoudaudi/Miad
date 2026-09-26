import { GeminiInvitationAiProvider } from './gemini-invitation-ai.provider';
import { ApiError } from '@google/genai';

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

const project = {
  name: 'Garden Dinner',
  description: 'An elegant evening among the garden.',
  files: [
    { path: 'index.html' as const, content: '<main class="card"><h1>Garden Dinner</h1></main>' },
    { path: 'styles.css' as const, content: 'body{margin:0;background:#fff}h1{font-size:3rem}' },
  ],
};

const sdkResponse = (value: unknown, tokens = 456) => ({
  text: JSON.stringify(value),
  candidates: [{ finishReason: 'STOP' }],
  usageMetadata: { totalTokenCount: tokens },
  sdkHttpResponse: { responseInternal: new Response(null, { status: 200 }) },
});

describe('GeminiInvitationAiProvider', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('uses Gemini structured JSON for website generation and Smart Question analysis', async () => {
    const provider = new GeminiInvitationAiProvider(
      config({ GEMINI_API_KEY: 'server-only-key', GEMINI_MODEL: 'gemini-3.8-flash' })
    );
    const generateContent = jest
      .fn()
      .mockResolvedValueOnce(sdkResponse({ project }, 789))
      .mockResolvedValueOnce(
        sdkResponse({ status: 'READY', collectedData: { eventType: 'Dinner' }, question: null })
      );
    const client = provider as unknown as {
      gemini: { models: { generateContent: jest.Mock } };
    };
    client.gemini.models.generateContent = generateContent;

    await expect(
      provider.generateHtml({ prompt: 'Create a calm garden dinner invitation', event })
    ).resolves.toMatchObject({
      provider: 'gemini',
      model: 'gemini-3.8-flash',
      tokensUsed: 789,
      project,
    });
    await expect(
      provider.analyzeDetails({ prompt: 'Create a garden dinner invitation', collectedData: {}, answers: [] })
    ).resolves.toEqual({ status: 'READY', collectedData: { eventType: 'Dinner' }, question: null });

    expect(generateContent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        model: 'gemini-3.8-flash',
        config: expect.objectContaining({
          responseMimeType: 'application/json',
          maxOutputTokens: 32_000,
        }),
      })
    );
    expect(generateContent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        model: 'gemini-3.8-flash',
        config: expect.objectContaining({
          responseMimeType: 'application/json',
          maxOutputTokens: 900,
        }),
      })
    );
    expect(JSON.stringify(generateContent.mock.calls)).not.toContain('server-only-key');
  });

  it('retries transient Gemini 503 failures up to the successful third attempt', async () => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const provider = new GeminiInvitationAiProvider(
      config({ GEMINI_API_KEY: 'server-only-key', GEMINI_MODEL: 'gemini-3.8-flash' })
    );
    const generateContent = jest
      .fn()
      .mockRejectedValueOnce(new ApiError({ status: 503, message: 'UNAVAILABLE' }))
      .mockRejectedValueOnce(new ApiError({ status: 503, message: 'UNAVAILABLE' }))
      .mockResolvedValueOnce(sdkResponse({ project }));
    const client = provider as unknown as {
      gemini: { models: { generateContent: jest.Mock } };
    };
    client.gemini.models.generateContent = generateContent;

    const result = provider.generateHtml({ prompt: 'Create a calm garden dinner invitation', event });
    await jest.runAllTimersAsync();

    await expect(result).resolves.toMatchObject({ provider: 'gemini', project });
    expect(generateContent).toHaveBeenCalledTimes(3);
  });
});
