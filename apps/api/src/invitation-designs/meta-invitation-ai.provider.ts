import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiGenerationCancelledError, InvitationAiProviderError } from './ai-provider.types';
import { OpenRouterInvitationAiProvider } from './openai-invitation-ai.provider';

const META_API_BASE_URL = 'https://api.meta.ai/v1';

type MetaChatCompletion = {
  choices?: Array<{
    message?: { content?: unknown; refusal?: unknown };
    finish_reason?: string | null;
  }>;
  usage?: { total_tokens?: number };
  error?: { type?: unknown; code?: unknown };
};

/**
 * Meta Model API transport for the existing invitation-AI contract. The
 * parent class continues to own prompts, JSON recovery, project normalization,
 * and strict source validation.
 */
@Injectable()
export class MetaInvitationAiProvider extends OpenRouterInvitationAiProvider {
  private readonly metaApiKey: string;

  constructor(config: ConfigService) {
    super(config);
    this.metaApiKey =
      config.get<string>('metaModelApiKey') || config.get<string>('MODEL_API_KEY') || '';
    this.model = config.get<string>('metaModel') || config.get<string>('META_MODEL') || 'muse-spark-1.3';
    this.providerName = 'meta';
  }

  protected override async requestJson(
    system: string,
    user: string,
    maxTokens: number,
    operation: string,
    options: { timeoutMs?: number; signal?: AbortSignal; onResponseReceived?: () => void } = {}
  ): Promise<{ value: unknown; tokensUsed: number | null }> {
    if (!this.metaApiKey) {
      throw new InvitationAiProviderError('AI provider is not configured.', 'configuration');
    }

    const { timeoutMs, signal, onResponseReceived } = options;
    const controller = new AbortController();
    const startedAt = Date.now();
    const timeout =
      timeoutMs !== undefined ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
    const onExternalAbort = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener('abort', onExternalAbort, { once: true });

    try {
      const response = await fetch(`${META_API_BASE_URL}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${this.metaApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          response_format: { type: 'json_object' },
          max_completion_tokens: maxTokens,
          temperature: 0.7,
        }),
      });
      const bodyText = await response.text();
      this.diagnostic('provider-response', {
        operation,
        provider: 'meta',
        httpStatus: response.status,
        model: this.model,
        durationMs: Date.now() - startedAt,
        contentType: response.headers.get('content-type') ?? 'unknown',
        responseLength: bodyText.length,
        ...(timeoutMs !== undefined ? { timeoutMs } : {}),
      });
      if (!response.ok) {
        this.diagnostic('provider-http-failure', {
          operation,
          provider: 'meta',
          httpStatus: response.status,
          durationMs: Date.now() - startedAt,
          responseCategory: this.errorCategory(bodyText),
        });
        throw new InvitationAiProviderError('AI provider request failed.', 'provider');
      }
      let body: MetaChatCompletion;
      try {
        body = JSON.parse(bodyText) as MetaChatCompletion;
      } catch {
        this.diagnostic('provider-envelope-parse-failure', {
          operation,
          provider: 'meta',
          durationMs: Date.now() - startedAt,
          responseLength: bodyText.length,
        });
        throw new InvitationAiProviderError('AI provider returned invalid output.', 'invalid-output');
      }
      const firstChoice = body.choices?.[0];
      const message = firstChoice?.message;
      this.diagnostic('provider-envelope', {
        operation,
        provider: 'meta',
        choicesPresent: Array.isArray(body.choices),
        choicesCount: body.choices?.length ?? 0,
        messagePresent: Boolean(message),
        contentType: message ? typeof message.content : 'missing',
        contentLength: typeof message?.content === 'string' ? message.content.length : 0,
        finishReason: firstChoice?.finish_reason ?? 'missing',
        refusalPresent: Boolean(message?.refusal),
      });
      if (
        message?.refusal ||
        typeof message?.content !== 'string' ||
        !message.content.trim() ||
        firstChoice?.finish_reason === 'length'
      ) {
        throw new InvitationAiProviderError('AI provider returned no usable output.', 'provider');
      }
      onResponseReceived?.();
      return {
        value: this.parseModelJson(message.content, operation, startedAt),
        tokensUsed: body.usage?.total_tokens ?? null,
      };
    } catch (error) {
      if (error instanceof InvitationAiProviderError) throw error;
      if (signal?.aborted) {
        this.diagnostic('provider-cancelled', {
          operation,
          provider: 'meta',
          durationMs: Date.now() - startedAt,
        });
        throw new AiGenerationCancelledError();
      }
      if (error instanceof Error && error.name === 'AbortError') {
        this.diagnostic('provider-timeout', {
          operation,
          provider: 'meta',
          ...(timeoutMs !== undefined ? { timeoutMs } : {}),
          durationMs: Date.now() - startedAt,
        });
        throw new InvitationAiProviderError('AI provider timed out.', 'timeout');
      }
      this.diagnostic('provider-request-failure', {
        operation,
        provider: 'meta',
        durationMs: Date.now() - startedAt,
        errorType: error instanceof Error ? error.name : typeof error,
      });
      throw new InvitationAiProviderError('AI provider request failed.', 'provider');
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      signal?.removeEventListener('abort', onExternalAbort);
    }
  }

  private errorCategory(bodyText: string): string {
    try {
      const body = JSON.parse(bodyText) as MetaChatCompletion;
      if (typeof body.error?.type === 'string') return body.error.type;
      if (typeof body.error?.code === 'string') return body.error.code;
    } catch {
      // Diagnostics intentionally omit provider response content.
    }
    return 'unknown';
  }
}
