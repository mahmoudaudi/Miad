import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { StitchMcpService } from './stitch-mcp.service';

const weddingPrompt =
  'Create a romantic wedding invitation landing page for Sarah and Ahmad. Use beautiful cinematic wedding photography, elegant floral imagery, and a warm romantic visual style.';

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

const event = {
  title: 'Sarah & Ahmad',
  eventType: 'Wedding',
  description: 'A warm celebration',
  eventDate: '2027-06-12',
  startTime: '18:00',
  venueName: 'The Garden',
  venueAddress: 'Beirut',
};

function toolsListResponse(): Response {
  return jsonResponse({
    jsonrpc: '2.0',
    id: 1,
    result: {
      tools: [
        {
          name: 'generate_screen_from_text',
          inputSchema: {
            properties: {
              modelId: {
                type: 'string',
                enum: ['MODEL_ID_UNSPECIFIED', 'GEMINI_3_8_FLASH', 'GEMINI_3_5_FLASH_LITE'],
                'x-google-enum-descriptions': [
                  'Unspecified model.',
                  'Gemini 3.8 Flash.',
                  'Gemini 3.5 Flash-Lite.',
                ],
              },
            },
          },
        },
      ],
    },
  });
}

function service(): StitchMcpService {
  return new StitchMcpService({
    get: () => 'server-only-key',
  } as unknown as ConfigService);
}

describe('StitchMcpService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('selects the DESIGN HTML when Stitch also returns generated IMAGE screens', async () => {
    const imageUrl = 'https://lh3.googleusercontent.com/aida/AEtjO1WeddingPhotoReference';
    const html = [
      '<!doctype html><html><head>',
      '<title>Sarah &amp; Ahmad</title>',
      '<style>img{display:block;width:100%;height:auto}</style>',
      '</head><body>',
      `<main><img src="${imageUrl}" alt="Sarah and Ahmad"><h1>Sarah &amp; Ahmad</h1></main>`,
      '</body></html>',
    ].join('');
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url === 'https://stitch.googleapis.com/mcp') {
        const request = JSON.parse(String(init?.body)) as {
          params: { name: string; arguments: Record<string, unknown> };
        };
        if (request.params.name === 'create_project') {
          return jsonResponse({
            jsonrpc: '2.0',
            id: 1,
            result: { structuredContent: { name: 'projects/project-1' } },
          });
        }
        expect(request.params.name).toBe('generate_screen_from_text');
        expect(request.params.arguments.prompt).toEqual(expect.stringContaining(weddingPrompt));
        expect(request.params.arguments.prompt).toEqual(
          expect.stringContaining('Use appropriate Stitch-generated imagery')
        );
        expect(request.params.arguments.prompt).toEqual(
          expect.stringContaining('Do not generate RSVP sections, forms, buttons, controls')
        );
        expect(request.params.arguments.prompt).toEqual(
          expect.stringContaining('Do not generate countdown timers or countdown displays')
        );
        expect(request.params.arguments.prompt).not.toMatch(/Do not use[^\n]*images/i);
        expect(request.params.arguments).not.toHaveProperty('modelId');
        return jsonResponse({
          jsonrpc: '2.0',
          id: 2,
          result: {
            structuredContent: {
              outputComponents: [
                {
                  design: {
                    screens: [
                      {
                        id: 'image-1',
                        name: 'projects/project-1/screens/image-1',
                        screenType: 'IMAGE',
                        screenshot: { downloadUrl: imageUrl },
                      },
                      {
                        id: 'design-1',
                        name: 'projects/project-1/screens/design-1',
                        screenType: 'DESIGN',
                        title: 'Sarah & Ahmad',
                        htmlCode: {
                          downloadUrl: 'https://contribution.usercontent.google.com/design.html',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        });
      }
      expect(url).toBe('https://contribution.usercontent.google.com/design.html');
      return new Response(html, {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    });
    const result = await service().generateHtml({
      prompt: weddingPrompt,
      event,
    });

    expect(result.body).toContain(`<img src="${imageUrl}" alt="Sarah and Ahmad">`);
    expect(result.css).toContain('img{display:block');
    expect(result).toMatchObject({ projectId: 'project-1', screenId: 'design-1' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const browserRequests = fetchMock.mock.calls.map(([input]) => String(input));
    expect(browserRequests).not.toContain(imageUrl);
  });

  it('discovers only selectable models from the current Stitch tool schema', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(toolsListResponse());

    await expect(service().getModelOptions()).resolves.toEqual({
      models: [
        expect.objectContaining({
          id: 'GEMINI_3_8_FLASH',
          name: 'Stitch — Gemini 3.8 Flash',
          operations: ['generation'],
          available: true,
        }),
        expect.objectContaining({
          id: 'GEMINI_3_5_FLASH_LITE',
          name: 'Stitch — Gemini 3.5 Flash-Lite',
          operations: ['generation'],
          available: true,
        }),
      ],
    });
  });

  it('revalidates and forwards an explicitly selected Stitch modelId', async () => {
    let generationArguments: Record<string, unknown> | undefined;
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      if (String(input) !== 'https://stitch.googleapis.com/mcp') {
        return new Response(
          '<html><head><style>body{margin:0}</style></head><body>Invite</body></html>'
        );
      }
      const request = JSON.parse(String(init?.body)) as {
        method: string;
        params?: { name?: string; arguments?: Record<string, unknown> };
      };
      if (request.method === 'tools/list') return toolsListResponse();
      if (request.params?.name === 'create_project') {
        return jsonResponse({
          jsonrpc: '2.0',
          id: 2,
          result: { structuredContent: { name: 'projects/project-1' } },
        });
      }
      generationArguments = request.params?.arguments;
      return jsonResponse({
        jsonrpc: '2.0',
        id: 3,
        result: {
          structuredContent: {
            screens: [
              {
                id: 'design-1',
                name: 'projects/project-1/screens/design-1',
                screenType: 'DESIGN',
                htmlCode: {
                  downloadUrl: 'https://contribution.usercontent.google.com/design.html',
                },
              },
            ],
          },
        },
      });
    });

    await service().generateHtml({
      prompt: weddingPrompt,
      event,
      modelId: 'GEMINI_3_8_FLASH',
    });

    expect(generationArguments).toMatchObject({ modelId: 'GEMINI_3_8_FLASH' });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('rejects unsupported model IDs before creating a Stitch project', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(toolsListResponse());

    await expect(
      service().generateHtml({
        prompt: weddingPrompt,
        event,
        modelId: 'UNVERIFIED_MODEL',
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('edits the selected existing Stitch screen with original context and the new request', async () => {
    let editArguments: Record<string, unknown> | undefined;
    jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url !== 'https://stitch.googleapis.com/mcp') {
        return new Response(
          '<html><head><title>Sarah &amp; Ahmad</title><style>h1{font-family:serif}</style></head><body><main><h1>Sarah &amp; Ahmad</h1><p>June 20, 2027</p></main></body></html>'
        );
      }
      const request = JSON.parse(String(init?.body)) as {
        params: { name: string; arguments: Record<string, unknown> };
      };
      expect(request.params.name).toBe('edit_screens');
      editArguments = request.params.arguments;
      return jsonResponse({
        jsonrpc: '2.0',
        id: 4,
        result: {
          structuredContent: {
            screens: [
              {
                id: 'design-2',
                name: 'projects/project-1/screens/design-2',
                screenType: 'DESIGN',
                htmlCode: {
                  downloadUrl: 'https://contribution.usercontent.google.com/edited.html',
                },
              },
            ],
          },
        },
      });
    });

    const result = await service().editHtml({
      prompt: 'Make the typography more elegant and make the hero image larger.',
      event: {
        ...event,
        description: [
          'Original request: Create a wedding invitation for Ahmad and Sara.',
          'Style: Luxury romantic',
          'Colors: Ivory and gold',
          'Date: June 20, 2027',
        ].join('\n'),
      },
      projectId: 'project-1',
      screenId: 'design-1',
    });

    expect(editArguments).toMatchObject({
      projectId: 'project-1',
      selectedScreenIds: ['design-1'],
    });
    const prompt = String(editArguments?.prompt);
    expect(prompt).toContain('Ahmad');
    expect(prompt).toContain('Sara');
    expect(prompt).toContain('Luxury romantic');
    expect(prompt).toContain('Ivory and gold');
    expect(prompt).toContain('June 20, 2027');
    expect(prompt).toContain('Make the typography more elegant and make the hero image larger.');
    expect(prompt).toContain('Never add or modify RSVP sections, forms, buttons, controls, or logic');
    expect(prompt).toContain('countdown timers or displays');
    expect(result).toMatchObject({ projectId: 'project-1', screenId: 'design-2' });
  });
});
