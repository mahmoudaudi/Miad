import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiError, GoogleGenAI } from '@google/genai';
import { AiGenerationCancelledError, InvitationAiProviderError } from './ai-provider.types';
import { OpenRouterInvitationAiProvider } from './openai-invitation-ai.provider';

const GEMINI_MAX_ATTEMPTS = 3;
const GEMINI_RETRY_BASE_DELAY_MS = 200;
const GEMINI_RETRY_JITTER_MS = 100;

/**
 * Gemini transport for the existing invitation-AI contract. The parent class
 * owns the prompts, JSON recovery, project normalization, and strict source
 * validation so the provider swap cannot alter those safeguards.
 */
@Injectable()
export class GeminiInvitationAiProvider extends OpenRouterInvitationAiProvider {
  private readonly geminiApiKey: string;
  private readonly gemini: GoogleGenAI;

  constructor(config: ConfigService) {
    super(config);
    this.geminiApiKey =
      config.get<string>('geminiApiKey') || config.get<string>('GEMINI_API_KEY') || '';
    this.model =
      config.get<string>('geminiModel') || config.get<string>('GEMINI_MODEL') || 'gemini-3.8-flash';
    this.providerName = 'gemini';
    this.gemini = new GoogleGenAI({
      apiKey: this.geminiApiKey || undefined,
      apiVersion: config.get<string>('geminiApiVersion') || config.get<string>('GEMINI_API_VERSION') || 'v1',
    });
  }

  protected override async requestJson(
    system: string,
    user: string,
    maxTokens: number,
    operation: string,
    options: { timeoutMs?: number; signal?: AbortSignal; onResponseReceived?: () => void } = {}
  ): Promise<{ value: unknown; tokensUsed: number | null }> {
    if (!this.geminiApiKey) {
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
      let response;
      for (let attempt = 1; attempt <= GEMINI_MAX_ATTEMPTS; attempt += 1) {
        try {
          response = await this.gemini.models.generateContent({
            model: this.model,
            contents: user,
            config: {
              systemInstruction: system,
              responseMimeType: 'application/json',
              maxOutputTokens: maxTokens,
              temperature: 0.7,
              abortSignal: controller.signal,
              // Gemini SDK retries are disabled so this bounded, abort-aware
              // provider policy is the sole retry mechanism.
              httpOptions: { retryOptions: { attempts: 1 } },
            },
          });
          break;
        } catch (error) {
          if (!this.isRetryableUnavailable(error) || attempt === GEMINI_MAX_ATTEMPTS) {
            throw error;
          }
          const delayMs =
            GEMINI_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1) +
            Math.floor(Math.random() * GEMINI_RETRY_JITTER_MS);
          this.diagnostic('provider-retry', {
            operation,
            provider: 'gemini',
            httpStatus: 503,
            attempt,
            nextAttempt: attempt + 1,
            delayMs,
          });
          await this.waitForRetry(delayMs, controller.signal);
        }
      }
      if (!response) throw new InvitationAiProviderError('AI provider request failed.', 'provider');
      const content = response.text ?? '';
      const firstCandidate = response.candidates?.[0];
      const finishReason = firstCandidate?.finishReason ?? 'missing';
      const httpStatus = response.sdkHttpResponse?.responseInternal.status ?? 200;
      this.diagnostic('provider-response', {
        operation,
        provider: 'gemini',
        httpStatus,
        model: this.model,
        durationMs: Date.now() - startedAt,
        contentType:
          response.sdkHttpResponse?.responseInternal.headers.get('content-type') ?? 'application/json',
        responseLength: content.length,
        ...(timeoutMs !== undefined ? { timeoutMs } : {}),
      });
      this.diagnostic('provider-envelope', {
        operation,
        choicesPresent: Array.isArray(response.candidates),
        choicesCount: response.candidates?.length ?? 0,
        messagePresent: Boolean(content),
        contentType: typeof content,
        contentLength: content.length,
        finishReason,
      });
      if (!content.trim() || finishReason === 'MAX_TOKENS') {
        this.diagnostic('provider-content-missing-or-refused', {
          operation,
          provider: 'gemini',
          durationMs: Date.now() - startedAt,
          ...(finishReason === 'MAX_TOKENS'
            ? {
                truncatedByMaxTokens: true,
                finishReason,
                maxTokens,
                contentLength: content.length,
                totalTokens: response.usageMetadata?.totalTokenCount ?? -1,
              }
            : {}),
        });
        throw new InvitationAiProviderError('AI provider returned no usable output.', 'provider');
      }
      onResponseReceived?.();
      return {
        value: this.parseModelJson(content, operation, startedAt),
        tokensUsed: response.usageMetadata?.totalTokenCount ?? null,
      };
    } catch (error) {
      if (error instanceof InvitationAiProviderError) throw error;
      if (signal?.aborted) {
        this.diagnostic('provider-cancelled', {
          operation,
          provider: 'gemini',
          durationMs: Date.now() - startedAt,
        });
        throw new AiGenerationCancelledError();
      }
      if (error instanceof Error && error.name === 'AbortError') {
        this.diagnostic('provider-timeout', {
          operation,
          provider: 'gemini',
          ...(timeoutMs !== undefined ? { timeoutMs } : {}),
          durationMs: Date.now() - startedAt,
        });
        throw new InvitationAiProviderError('AI provider timed out.', 'timeout');
      }
      this.diagnostic('provider-request-failure', {
        operation,
        provider: 'gemini',
        durationMs: Date.now() - startedAt,
        errorType: error instanceof Error ? error.name : typeof error,
        ...(error instanceof ApiError ? { httpStatus: error.status } : {}),
      });
      throw new InvitationAiProviderError('AI provider request failed.', 'provider');
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      signal?.removeEventListener('abort', onExternalAbort);
    }
  }

  private isRetryableUnavailable(error: unknown): error is ApiError {
    return error instanceof ApiError && error.status === 503;
  }

  private waitForRetry(delayMs: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
        return;
      }
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }, delayMs);
      const onAbort = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
    });
  }
}
