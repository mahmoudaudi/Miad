import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  InvitationAiGenerateInput,
  InvitationAiProvider,
  InvitationAiProviderError,
  InvitationAiResult,
} from './ai-provider.types';

type GroqChatResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: { total_tokens?: number };
};

/**
 * Groq provider through its OpenAI-compatible chat-completions API.
 * Implements the same InvitationAiProvider contract as the OpenAI provider,
 * so orchestration, normalization, persistence, telemetry, throttling, and
 * error mapping in InvitationDesignsService are reused untouched.
 * Groq has no /responses endpoint, hence chat completions + json_object mode;
 * imperfect output is still caught by server-side normalization downstream.
 */
@Injectable()
export class GroqInvitationAiProvider implements InvitationAiProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('GROQ_API_KEY') ?? '';
    this.model = this.config.get<string>('GROQ_MODEL') ?? 'openai/gpt-oss-120b';
    this.baseUrl = (
      this.config.get<string>('GROQ_BASE_URL') ?? 'https://api.groq.com/openai/v1'
    ).replace(/\/$/, '');
    this.timeoutMs = this.config.get<number>('AI_PROVIDER_TIMEOUT_MS') ?? 20_000;
  }

  async generateDesign(input: InvitationAiGenerateInput): Promise<InvitationAiResult> {
    if (!this.apiKey) {
      throw new InvitationAiProviderError('AI provider is not configured.', 'configuration');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: this.systemPrompt() },
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
          max_tokens: 2400,
          response_format: { type: 'json_object' },
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

      const body = JSON.parse(bodyText) as GroqChatResponse;
      const outputText = this.extractOutputText(body);
      const specification = JSON.parse(outputText) as InvitationAiResult['specification'];
      return {
        specification,
        tokensUsed: body.usage?.total_tokens ?? null,
        provider: 'groq',
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

  private extractOutputText(body: GroqChatResponse): string {
    const text = body.choices?.[0]?.message?.content;
    if (typeof text === 'string' && text.trim()) return text;
    throw new InvitationAiProviderError(
      'AI provider returned no structured output.',
      'invalid-output'
    );
  }

  private systemPrompt(): string {
    return [
      'You generate digital invitation design JSON only.',
      'Return a single complete invitation design JSON object and nothing else.',
      'No markdown fences, no commentary, no extra keys.',
      'The object must have exactly these keys: schemaVersion, theme, content, colors, typography, layout, sections, elements.',
      'schemaVersion must be 1.',
      'theme must be one of: classic-ivory, modern-contrast, romantic-blush.',
      'content must have eyebrow (<=80 chars), title (<=120 chars), dateLine (<=100 chars), venueLine (<=160 chars).',
      'colors background, surface, text, accent must each match ^#[0-9A-F]{6}$ (uppercase hex).',
      'typography headingFamily and bodyFamily must each be Playfair Display or Inter.',
      'layout alignment must be center or left; density must be airy or compact.',
      'sections: 3 to 8 items, each with id, type (hero, details, story, schedule, rsvp, note), title (<=120), body (<=500), order (0-20), visible (boolean).',
      'elements: 3 to 12 items, each with id, type (text, image, section), label (<=80), text (<=300 or null), imageUrl (https URL or null), x (0-100), y (0-100), width (8-100), height (4-100), fontSize (10-96), color (^#[0-9A-F]{6}$), backgroundColor (hex or null).',
      'Preserve the event title/date/venue truthfully. Do not invent venue logistics.',
      'For refine operations, modify the supplied currentDesign instead of creating an unrelated design.',
      'Keep all text polished, concise, and suitable for a public invitation.',
    ].join(' ');
  }
}
