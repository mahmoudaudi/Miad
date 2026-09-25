import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InvitationAiEventDetails,
  InvitationAiGenerateInput,
  InvitationAiProvider,
  InvitationAiProviderError,
  InvitationAiResult,
  InvitationHtmlAiGenerateInput,
  InvitationHtmlAiResult,
} from './ai-provider.types';

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string; refusal?: string }>;
  }>;
  usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number };
};

const invitationDesignSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion',
    'theme',
    'content',
    'colors',
    'typography',
    'layout',
    'sections',
    'elements',
  ],
  properties: {
    schemaVersion: { type: 'number', enum: [1] },
    theme: {
      type: 'string',
      enum: [
        'classic-ivory',
        'modern-contrast',
        'romantic-blush',
        'midnight-onyx',
        'sage-garden',
        'ocean-pearl',
        'terracotta-fiesta',
        'lavender-mist',
        'emerald-evening',
      ],
    },
    content: {
      type: 'object',
      additionalProperties: false,
      required: ['eyebrow', 'title', 'dateLine', 'venueLine'],
      properties: {
        eyebrow: { type: 'string', minLength: 1, maxLength: 80 },
        title: { type: 'string', minLength: 1, maxLength: 120 },
        dateLine: { type: 'string', minLength: 1, maxLength: 100 },
        venueLine: { type: 'string', minLength: 1, maxLength: 160 },
      },
    },
    colors: {
      type: 'object',
      additionalProperties: false,
      required: ['background', 'surface', 'text', 'accent'],
      properties: {
        background: { type: 'string', pattern: '^#[0-9A-F]{6}$' },
        surface: { type: 'string', pattern: '^#[0-9A-F]{6}$' },
        text: { type: 'string', pattern: '^#[0-9A-F]{6}$' },
        accent: { type: 'string', pattern: '^#[0-9A-F]{6}$' },
      },
    },
    typography: {
      type: 'object',
      additionalProperties: false,
      required: ['headingFamily', 'bodyFamily'],
      properties: {
        headingFamily: { type: 'string', enum: ['Playfair Display', 'Inter'] },
        bodyFamily: { type: 'string', enum: ['Playfair Display', 'Inter'] },
      },
    },
    layout: {
      type: 'object',
      additionalProperties: false,
      required: ['alignment', 'density'],
      properties: {
        alignment: { type: 'string', enum: ['center', 'left'] },
        density: { type: 'string', enum: ['airy', 'compact'] },
      },
    },
    sections: {
      type: 'array',
      minItems: 3,
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'type', 'title', 'body', 'order', 'visible'],
        properties: {
          id: { type: 'string', minLength: 1, maxLength: 64 },
          type: {
            type: 'string',
            enum: ['hero', 'details', 'story', 'schedule', 'rsvp', 'note'],
          },
          title: { type: 'string', minLength: 1, maxLength: 120 },
          body: { type: 'string', minLength: 1, maxLength: 500 },
          order: { type: 'number', minimum: 0, maximum: 20 },
          visible: { type: 'boolean' },
          variant: { type: 'string', enum: ['centered', 'split', 'overlay', 'minimal'] },
        },
      },
    },
    elements: {
      type: 'array',
      minItems: 3,
      maxItems: 12,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'type',
          'label',
          'text',
          'imageUrl',
          'x',
          'y',
          'width',
          'height',
          'fontSize',
          'color',
          'backgroundColor',
        ],
        properties: {
          id: { type: 'string', minLength: 1, maxLength: 64 },
          type: { type: 'string', enum: ['text', 'image', 'section'] },
          label: { type: 'string', minLength: 1, maxLength: 80 },
          text: { type: ['string', 'null'], maxLength: 300 },
          imageUrl: { type: ['string', 'null'], maxLength: 1000 },
          x: { type: 'number', minimum: 0, maximum: 100 },
          y: { type: 'number', minimum: 0, maximum: 100 },
          width: { type: 'number', minimum: 8, maximum: 100 },
          height: { type: 'number', minimum: 4, maximum: 100 },
          fontSize: { type: 'number', minimum: 10, maximum: 96 },
          color: { type: 'string', pattern: '^#[0-9A-F]{6}$' },
          backgroundColor: { type: ['string', 'null'], pattern: '^#[0-9A-F]{6}$' },
        },
      },
    },
  },
};

const eventDetailsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'eventType', 'eventDate', 'venueName'],
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 100 },
    eventType: { type: 'string', minLength: 1, maxLength: 100 },
    eventDate: {
      type: ['string', 'null'],
      pattern: '^\\d{4}-\\d{2}-\\d{2}$',
      maxLength: 10,
    },
    venueName: { type: ['string', 'null'], maxLength: 255 },
  },
};

const htmlArtifactSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description', 'body', 'css'],
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 120 },
    description: { type: 'string', minLength: 1, maxLength: 300 },
    body: { type: 'string', minLength: 1, maxLength: 30000 },
    css: { type: 'string', minLength: 1, maxLength: 25000 },
  },
};

const workspaceDesignReference = [
  'Create a Miad event-invitation workspace with a Replit-inspired IDE layout, not a marketing landing page.',
  'Use a compact 44px top bar, a 224px left workspace sidebar, a 430px center agent stream, and a flexible right canvas.',
  'The top bar contains Miad branding, Design and Build tabs, a run/preview control, Tools, Preview, Invite, and Publish controls.',
  'The sidebar contains a personal workspace selector, Overview, Invitations, Events, Security, and a recent invitations list.',
  'The center panel contains the event prompt, agent narrative, a presented-output card, and a compact message composer.',
  'The right canvas uses a light stone background, neutral skeleton blocks, a centered invitation preview, and a compact bottom status strip.',
  'Use the visual tokens #F8F9FA, #FFFFFF, #E5E7EB, #EBEBE6, #DDDDCF, #0053EB, and #F26207 with compact Inter-style typography.',
  'Populate the interface with the supplied event details; do not invent referrals, usage statistics, social proof, or external resources.',
].join(' ');

@Injectable()
export class OpenAIInvitationAiProvider implements InvitationAiProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.apiKey =
      this.config.get<string>('openaiApiKey') || this.config.get<string>('OPENAI_API_KEY') || '';
    this.model =
      this.config.get<string>('openaiModel') ||
      this.config.get<string>('OPENAI_MODEL') ||
      'gpt-4o-mini';
    this.baseUrl = (
      this.config.get<string>('openaiBaseUrl') ||
      this.config.get<string>('OPENAI_BASE_URL') ||
      'https://api.openai.com/v1'
    ).replace(/\/$/, '');
    this.timeoutMs =
      this.config.get<number>('aiProviderTimeoutMs') ||
      this.config.get<number>('AI_PROVIDER_TIMEOUT_MS') ||
      20_000;
  }

  async generateDesign(input: InvitationAiGenerateInput): Promise<InvitationAiResult> {
    if (!this.apiKey) {
      throw new InvitationAiProviderError('AI provider is not configured.', 'configuration');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/responses`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: [
            {
              role: 'system',
              content: this.systemPrompt(),
            },
            {
              role: 'user',
              content: JSON.stringify({
                operation: input.operation,
                prompt: input.prompt,
                event: input.event,
                currentDesign: input.currentDesign,
              }),
            },
          ],
          max_output_tokens: 2400,
          text: {
            format: {
              type: 'json_schema',
              name: 'invitation_design',
              strict: true,
              schema: invitationDesignSchema,
            },
          },
        }),
      });

      const bodyText = await response.text();
      if (!response.ok) {
        throw new InvitationAiProviderError(
          'AI provider request failed.',
          'provider',
          bodyText.slice(0, 500)
        );
      }

      const body = JSON.parse(bodyText) as OpenAIResponse;
      const outputText = this.extractOutputText(body);
      const specification = JSON.parse(outputText) as InvitationAiResult['specification'];
      return {
        specification,
        tokensUsed: body.usage?.total_tokens ?? null,
        provider: 'openai',
        model: this.model,
      };
    } catch (error) {
      if (error instanceof InvitationAiProviderError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new InvitationAiProviderError('AI provider timed out.', 'timeout', error);
      }
      throw new InvitationAiProviderError(
        'AI provider returned invalid output.',
        'invalid-output',
        error
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateHtml(input: InvitationHtmlAiGenerateInput): Promise<InvitationHtmlAiResult> {
    if (!this.apiKey) {
      throw new InvitationAiProviderError('AI provider is not configured.', 'configuration');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/responses`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: [
            {
              role: 'system',
              content: this.htmlSystemPrompt(),
            },
            {
              role: 'user',
              content: JSON.stringify({
                prompt: input.prompt,
                event: input.event,
              }),
            },
          ],
          max_output_tokens: 6000,
          text: {
            format: {
              type: 'json_schema',
              name: 'invitation_html',
              strict: true,
              schema: htmlArtifactSchema,
            },
          },
        }),
      });

      const bodyText = await response.text();
      if (!response.ok) {
        throw new InvitationAiProviderError(
          'AI provider request failed.',
          'provider',
          bodyText.slice(0, 500)
        );
      }

      const body = JSON.parse(bodyText) as OpenAIResponse;
      const outputText = this.extractOutputText(body);
      const artifact = JSON.parse(outputText) as InvitationHtmlAiResult['artifact'];
      return {
        artifact,
        tokensUsed: body.usage?.total_tokens ?? null,
        provider: 'openai',
        model: this.model,
      };
    } catch (error) {
      if (error instanceof InvitationAiProviderError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new InvitationAiProviderError('AI provider timed out.', 'timeout', error);
      }
      throw new InvitationAiProviderError(
        'AI provider returned invalid output.',
        'invalid-output',
        error
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  async extractEventDetails(prompt: string): Promise<InvitationAiEventDetails> {
    if (!this.apiKey) {
      throw new InvitationAiProviderError('AI provider is not configured.', 'configuration');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/responses`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: [
            {
              role: 'system',
              content:
                'Extract event details from the user prompt. Return a JSON object only, ' +
                'with keys title, eventType, eventDate (YYYY-MM-DD or null when absent), ' +
                'venueName (or null when absent). Never invent a venue or date.',
            },
            { role: 'user', content: prompt },
          ],
          max_output_tokens: 300,
          text: {
            format: {
              type: 'json_schema',
              name: 'event_details',
              strict: true,
              schema: eventDetailsSchema,
            },
          },
        }),
      });

      const bodyText = await response.text();
      if (!response.ok) {
        throw new InvitationAiProviderError(
          'AI provider request failed.',
          'provider',
          bodyText.slice(0, 500)
        );
      }
      const body = JSON.parse(bodyText) as OpenAIResponse;
      return JSON.parse(this.extractOutputText(body)) as InvitationAiEventDetails;
    } catch (error) {
      if (error instanceof InvitationAiProviderError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new InvitationAiProviderError('AI provider timed out.', 'timeout', error);
      }
      throw new InvitationAiProviderError(
        'AI provider returned invalid output.',
        'invalid-output',
        error
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractOutputText(body: OpenAIResponse): string {
    if (typeof body.output_text === 'string' && body.output_text.trim()) {
      return body.output_text;
    }
    const refusal = body.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => typeof content.refusal === 'string')?.refusal;
    if (refusal) {
      throw new InvitationAiProviderError('AI provider refused the request.', 'provider', refusal);
    }
    const text = body.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .find((candidate): candidate is string => Boolean(candidate?.trim()));
    if (!text) {
      throw new InvitationAiProviderError(
        'AI provider returned no structured output.',
        'invalid-output'
      );
    }
    return text;
  }

  private systemPrompt(): string {
    return [
      'You generate digital invitation design JSON only.',
      'Return a complete invitation design matching the JSON schema.',
      'Preserve the event title/date/venue truthfully. Do not invent venue logistics.',
      'For refine operations, modify the supplied currentDesign instead of creating an unrelated design.',
      'Do not include HTML, scripts, markdown, tracking URLs, or unsafe image URLs.',
      'Use only supported theme, font, section, and element values.',
      'Keep all text polished, concise, and suitable for a public invitation.',
    ].join(' ');
  }

  private htmlSystemPrompt(): string {
    return [
      'You generate standalone static invitation artifacts as JSON matching the schema.',
      workspaceDesignReference,
      'Return body as an HTML body fragment, never a full document.',
      'Use semantic presentational tags and class attributes; do not use inline style attributes.',
      'Return CSS separately and keep all styling self-contained.',
      'Never include scripts, event handlers, iframes, forms, links, images, external resources, @import, url(), expressions, or tracking.',
      'Preserve the supplied event title, date, time, and venue truthfully and do not invent logistics.',
      'Return a concise plain-text title and description with no HTML markup or markdown.',
    ].join(' ');
  }
}
