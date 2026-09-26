import { MetaInvitationAiProvider } from './meta-invitation-ai.provider';

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
  project: {
    name: 'Garden Dinner',
    description: 'An elegant evening among the garden.',
    files: [
      { path: 'index.html', content: '<main class="card"><h1>Garden Dinner</h1></main>' },
      { path: 'styles.css', content: 'body{margin:0;background:#fff}h1{font-size:3rem}' },
    ],
  },
};

describe('MetaInvitationAiProvider', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('uses Meta chat completions with server-only Bearer authentication and JSON output', async () => {
    let request: { url: string; init: RequestInit } | undefined;
    global.fetch = jest.fn(async (url: string, init: RequestInit) => {
      request = { url, init };
      return new Response(
        JSON.stringify({
          choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(project) } }],
          usage: { total_tokens: 789 },
        }),
        { status: 200 }
      );
    }) as never;
    const provider = new MetaInvitationAiProvider(
      config({ MODEL_API_KEY: 'meta-server-only-key', META_MODEL: 'muse-spark-1.3' })
    );

    await expect(
      provider.generateHtml({ prompt: 'Create a calm garden dinner invitation', event })
    ).resolves.toMatchObject({
      provider: 'meta',
      model: 'muse-spark-1.3',
      tokensUsed: 789,
      project: project.project,
    });

    expect(request?.url).toBe('https://api.meta.ai/v1/chat/completions');
    expect(request?.init.headers).toMatchObject({ Authorization: 'Bearer meta-server-only-key' });
    const body = JSON.parse(String(request?.init.body));
    expect(body).toMatchObject({
      model: 'muse-spark-1.3',
      response_format: { type: 'json_object' },
      max_completion_tokens: 32_000,
    });
    expect(JSON.stringify(body)).not.toContain('meta-server-only-key');
  });
});
