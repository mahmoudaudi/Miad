import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parseSmartAnalysis } from '../ai-studio/smart-question.types';
import {
  AiGenerationCancelledError,
  InvitationAiAnalysisRequest,
  InvitationAiEventDetails,
  InvitationAiGenerateInput,
  InvitationAiProvider,
  InvitationAiProviderError,
  InvitationAiResult,
  InvitationHtmlAiGenerateInput,
  InvitationHtmlAiResult,
  type GeneratedWebsiteProject,
} from './ai-provider.types';
import { AiModelRoutingService, type AiModelOperation } from './ai-model-routing.service';
import { HtmlArtifactValidationError } from './html-artifact';

type OpenRouterResponse = {
  choices?: Array<{
    finish_reason?: string | null;
    message?: { content?: unknown; refusal?: string | null };
  }>;
  usage?: { total_tokens?: number };
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
            enum: ['hero', 'details', 'story', 'schedule', 'note'],
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

/**
 * Completion budget for one website project.
 *
 * Provider attempts have a bounded timeout, but the completion budget must be
 * large enough that the model can finish the
 * JSON envelope, because a response cut off mid-object is unparseable. Reasoning
 * tokens count against the same budget, so a verbose model can spend most of it
 * before writing any source. Observed truncations at 12000 (finishReason
 * "length" with the project JSON cut in half) make a generous ceiling necessary.
 */
const WEBSITE_GENERATION_MAX_TOKENS = 32_000;

@Injectable()
export class OpenRouterInvitationAiProvider implements InvitationAiProvider {
  private readonly logger = new Logger(OpenRouterInvitationAiProvider.name);
  private readonly apiKey: string;
  protected model: string;
  private readonly baseUrl: string;
  protected readonly extractionTimeoutMs: number;
  private readonly requestTimeoutMs: number;
  private readonly modelRouting: AiModelRoutingService;
  private readonly diagnosticsEnabled: boolean;
  private readonly strictDesignValidation: boolean;
  protected providerName = 'openrouter';

  constructor(
    private readonly config: ConfigService,
    @Optional() modelRouting?: AiModelRoutingService
  ) {
    this.apiKey =
      this.config.get<string>('openrouterApiKey') ||
      this.config.get<string>('OPENROUTER_API_KEY') ||
      '';
    this.model =
      this.config.get<string>('openrouterModel') ||
      this.config.get<string>('OPENROUTER_MODEL') ||
      'deepseek/deepseek-v4.1-flash';
    this.modelRouting = modelRouting ?? new AiModelRoutingService(config);
    this.baseUrl = (
      this.config.get<string>('openrouterBaseUrl') ||
      this.config.get<string>('OPENROUTER_BASE_URL') ||
      'https://openrouter.ai/api/v1'
    ).replace(/\/$/, '');
    this.extractionTimeoutMs =
      this.config.get<number>('openrouterExtractionTimeoutMs') ||
      this.config.get<number>('OPENROUTER_EXTRACTION_TIMEOUT_MS') ||
      this.config.get<number>('aiProviderTimeoutMs') ||
      this.config.get<number>('AI_PROVIDER_TIMEOUT_MS') ||
      20_000;
    this.requestTimeoutMs =
      this.config.get<number>('openrouterRequestTimeoutMs') ||
      this.config.get<number>('OPENROUTER_REQUEST_TIMEOUT_MS') ||
      120_000;
    this.strictDesignValidation =
      this.config.get<boolean>('aiStrictDesignValidation') ??
      this.config.get<boolean>('AI_STRICT_DESIGN_VALIDATION') ??
      false;
    this.diagnosticsEnabled =
      (this.config.get<string>('nodeEnv') ??
        this.config.get<string>('NODE_ENV') ??
        process.env.NODE_ENV ??
        'development') === 'development';
  }

  async generateDesign(input: InvitationAiGenerateInput): Promise<InvitationAiResult> {
    const operation: AiModelOperation = input.operation === 'refine' ? 'refinement' : 'generation';
    const routed = await this.withModelFallback(
      operation,
      'structured-design-generation',
      async (model) => {
        const response = await this.requestJson(
          this.designSystemPrompt(),
          JSON.stringify({
            operation: input.operation,
            prompt: input.prompt,
            event: input.event,
            currentDesign: input.currentDesign,
          }),
          2600,
          'structured-design-generation',
          { model }
        );
        if (!isObject(response.value)) this.invalidModelOutput('structured-design-shape');
        if (input.validateSpecification) {
          try {
            input.validateSpecification(response.value);
          } catch {
            this.invalidModelOutput('structured-design-validation');
          }
        }
        return response;
      },
      { modelPreference: input.modelPreference }
    );
    const { value: response, model } = routed;
    return {
      specification: response.value as InvitationAiResult['specification'],
      tokensUsed: response.tokensUsed,
      provider: this.providerName,
      model,
    };
  }

  async generateHtml(input: InvitationHtmlAiGenerateInput): Promise<InvitationHtmlAiResult> {
    return this.generateWebsiteProject({
      prompt: input.prompt,
      event: input.event,
      modelOperation: 'generation',
      modelPreference: input.modelPreference,
      onProgress: input.onProgress,
      signal: input.signal,
    });
  }

  async refineHtml(input: {
    invitationId?: string;
    prompt: string;
    event: InvitationHtmlAiGenerateInput['event'];
    project: GeneratedWebsiteProject;
    signal?: AbortSignal;
    onProgress?: InvitationHtmlAiGenerateInput['onProgress'];
    validateArtifact?: (artifact: InvitationHtmlAiResult['artifact']) => void;
    modelPreference?: 'auto' | string;
  }): Promise<InvitationHtmlAiResult> {
    return this.generateWebsiteProject({
      prompt: input.prompt,
      event: input.event,
      currentProject: input.project,
      modelOperation: 'refinement',
      modelPreference: input.modelPreference,
      invitationId: input.invitationId,
      signal: input.signal,
      onProgress: input.onProgress,
      validateArtifact: input.validateArtifact,
    });
  }

  async extractEventDetails(
    prompt: string,
    modelPreference: 'auto' | string = 'auto'
  ): Promise<InvitationAiEventDetails> {
    const { value: response } = await this.withModelFallback(
      'generation',
      'event-detail-extraction',
      async (model) => {
        const result = await this.requestJson(
          'Extract event details from the user prompt. Return JSON only with title, eventType, eventDate (YYYY-MM-DD or null), and venueName (or null). Never invent a venue or date. Expected shape: ' +
            JSON.stringify(eventDetailsSchema),
          prompt,
          400,
          'event-detail-extraction',
          { timeoutMs: this.extractionTimeoutMs, model }
        );
        if (
          !isObject(result.value) ||
          typeof result.value.title !== 'string' ||
          typeof result.value.eventType !== 'string'
        )
          this.invalidModelOutput('event-details-shape');
        return result;
      },
      { modelPreference }
    );
    return response.value as InvitationAiEventDetails;
  }

  /**
   * Smart Question Flow analysis. Returns the raw model JSON; the AI Studio
   * service validates it strictly before anything reaches a client. Small
   * budget — this must stay fast and never become a second generator.
   */
  async analyzeDetails(input: InvitationAiAnalysisRequest): Promise<unknown> {
    const { value: response } = await this.withModelFallback(
      'smart-questions',
      'smart-question-analysis',
      async (model) => {
        const result = await this.requestJson(
          this.smartQuestionSystemPrompt(),
          JSON.stringify({
            prompt: input.prompt,
            collectedData: input.collectedData,
            answers: input.answers,
            lastQuestionId: input.lastQuestionId ?? null,
          }),
          900,
          'smart-question-analysis',
          { signal: input.signal, timeoutMs: this.extractionTimeoutMs, model }
        );
        if (!parseSmartAnalysis(result.value)) this.invalidModelOutput('smart-analysis-shape');
        return result;
      },
      { modelPreference: input.modelPreference }
    );
    return response.value;
  }

  private async generateWebsiteProject(input: {
    prompt: string;
    event: InvitationHtmlAiGenerateInput['event'];
    modelOperation: 'generation' | 'refinement';
    modelPreference?: 'auto' | string;
    invitationId?: string;
    validateArtifact?: (artifact: InvitationHtmlAiResult['artifact']) => void;
    currentProject?: GeneratedWebsiteProject;
    onProgress?: InvitationHtmlAiGenerateInput['onProgress'];
    signal?: AbortSignal;
  }): Promise<InvitationHtmlAiResult> {
    // The abort signal and progress callback stay out of the model payload.
    const operation = input.currentProject ? 'website-refinement' : 'website-generation';
    let stage = 'provider-request';
    const {
      value: { response, project, artifact },
      model,
    } = await this.withModelFallback(
      input.modelOperation,
      operation,
      async (model) => {
        stage = 'provider-request';
        const result = await this.requestJson(
          this.websiteSystemPrompt(Boolean(input.currentProject)),
          JSON.stringify({
            prompt: input.prompt,
            event: input.event,
            currentProject: input.currentProject,
          }),
          WEBSITE_GENERATION_MAX_TOKENS,
          operation,
          {
            model,
            signal: input.signal,
            onResponseReceived: () => {
              stage = 'response-parsing';
              input.onProgress?.('PARSING_RESPONSE');
            },
          }
        );
        stage = 'output-normalization';
        input.onProgress?.('VALIDATING_WEBSITE');
        const project = this.parseWebsiteProject(result.value);
        const html = project.files.find((file) => file.path === 'index.html')!.content;
        const css = project.files.find((file) => file.path === 'styles.css')!.content;
        const artifact = {
          title: project.name,
          description: project.description,
          body: html,
          css,
        };
        if (input.validateArtifact) {
          stage = 'artifact-validation';
          try {
            input.validateArtifact(artifact);
          } catch (error) {
            if (error instanceof HtmlArtifactValidationError && error.category === 'security') {
              this.diagnostic('model-output-validation-failure', {
                reason: 'html-artifact-security-validation',
              });
              throw new InvitationAiProviderError(
                'AI output did not pass security validation.',
                'invalid-output',
                undefined,
                null,
                false
              );
            }
            this.invalidModelOutput('html-artifact-validation');
          }
        }
        stage = 'output-validated';
        return { response: result, project, artifact };
      },
      {
        invitationId: input.invitationId,
        stage: () => stage,
        modelPreference: input.modelPreference,
      }
    );
    return {
      project,
      artifact,
      tokensUsed: response.tokensUsed,
      provider: this.providerName,
      model,
    };
  }

  protected async requestJson(
    system: string,
    user: string,
    maxTokens: number,
    operation: string,
    options: {
      model?: string;
      timeoutMs?: number;
      signal?: AbortSignal;
      onResponseReceived?: () => void;
    } = {}
  ): Promise<{ value: unknown; tokensUsed: number | null }> {
    const model = options.model ?? this.model;
    if (!this.apiKey) {
      if (this.diagnosticsEnabled) {
        this.logger.warn({
          event: 'provider-request-failure',
          provider: this.providerName,
          operation,
          model,
          failureCategory: 'configuration',
          httpStatus: null,
          responseContentType: 'unavailable',
          ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
          durationMs: 0,
        });
      }
      throw new InvitationAiProviderError('AI provider is not configured.', 'configuration');
    }
    const { signal, onResponseReceived } = options;
    const timeoutMs = options.timeoutMs ?? this.requestTimeoutMs;
    const controller = new AbortController();
    const startedAt = Date.now();
    let httpStatus: number | null = null;
    let responseContentType = 'unavailable';
    let failurePhase: 'request' | 'http-response' | 'response-content' | 'model-json-parse' =
      'request';
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const onExternalAbort = () => controller.abort();
    if (signal?.aborted) {
      controller.abort();
    } else {
      signal?.addEventListener('abort', onExternalAbort, { once: true });
    }
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: controller.signal,
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          response_format: { type: 'json_object' },
          max_tokens: maxTokens,
          temperature: 0.7,
        }),
      });
      httpStatus = response.status;
      responseContentType = response.headers.get('content-type') ?? 'missing';
      failurePhase = response.ok ? 'response-content' : 'http-response';
      const bodyText = await response.text();
      const responseMetadata: Record<string, string | number | boolean | string[]> = {
        operation,
        httpStatus: response.status,
        model,
        durationMs: Date.now() - startedAt,
        contentType: response.headers.get('content-type') ?? 'unknown',
        responseLength: bodyText.length,
      };
      if (timeoutMs !== undefined) responseMetadata.timeoutMs = timeoutMs;
      this.diagnostic('provider-response', responseMetadata);
      if (!response.ok) {
        const retryable =
          response.status === 404 ||
          response.status === 408 ||
          response.status === 429 ||
          response.status >= 500;
        const failureCategory =
          response.status === 402
            ? 'payment-required'
            : response.status === 429
              ? 'rate-limit'
              : retryable
                ? 'provider-unavailable'
                : 'request-rejected';
        this.diagnostic('provider-http-failure', {
          operation,
          httpStatus: response.status,
          failureCategory,
          durationMs: Date.now() - startedAt,
        });
        throw new InvitationAiProviderError(
          'AI provider request failed.',
          response.status === 400 ? 'input' : 'provider',
          undefined,
          response.status,
          retryable
        );
      }
      failurePhase = 'model-json-parse';
      let body: OpenRouterResponse;
      try {
        body = JSON.parse(bodyText) as OpenRouterResponse;
      } catch {
        this.diagnostic('provider-envelope-parse-failure', {
          operation,
          durationMs: Date.now() - startedAt,
          responseLength: bodyText.length,
        });
        throw new InvitationAiProviderError(
          'AI provider returned invalid output.',
          'invalid-output'
        );
      }
      const firstChoice = body.choices?.[0];
      const message = firstChoice?.message;
      this.diagnostic('provider-envelope', {
        operation,
        responseKeys: Object.keys(body).sort(),
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
        // "length" means the completion budget ran out mid-object, so the
        // payload can never parse. Log it distinctly: this is a capacity
        // problem, not a malformed-model problem.
        this.diagnostic('provider-content-missing-or-refused', {
          operation,
          durationMs: Date.now() - startedAt,
          ...(firstChoice?.finish_reason === 'length'
            ? {
                truncatedByMaxTokens: true,
                finishReason: 'length',
                maxTokens,
                contentLength: typeof message?.content === 'string' ? message.content.length : 0,
                totalTokens: body.usage?.total_tokens ?? -1,
              }
            : {}),
        });
        throw new InvitationAiProviderError(
          'AI provider returned no usable output.',
          'invalid-output',
          undefined,
          response.status,
          true
        );
      }
      onResponseReceived?.();
      return {
        value: this.parseModelJson(message.content, operation, startedAt),
        tokensUsed: body.usage?.total_tokens ?? null,
      };
    } catch (error) {
      if (signal?.aborted) {
        this.diagnostic('provider-cancelled', {
          operation,
          durationMs: Date.now() - startedAt,
        });
        throw new AiGenerationCancelledError();
      }
      if (this.diagnosticsEnabled) {
        const failureCategory =
          error instanceof InvitationAiProviderError && error.status === 'configuration'
            ? 'configuration'
            : (error instanceof InvitationAiProviderError && error.status === 'timeout') ||
                (error instanceof Error && error.name === 'AbortError')
              ? 'timeout'
              : failurePhase === 'http-response'
                ? 'http-failure'
                : failurePhase === 'model-json-parse'
                  ? 'model-json-parse-failure'
                  : failurePhase === 'response-content'
                    ? 'response-content-failure'
                    : 'request-failure';
        this.logger.warn({
          event: 'provider-request-failure',
          provider: this.providerName,
          operation,
          model,
          failureCategory,
          httpStatus,
          responseContentType,
          ...(timeoutMs !== undefined ? { timeoutMs } : {}),
          durationMs: Date.now() - startedAt,
        });
      }
      if (error instanceof InvitationAiProviderError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        this.diagnostic('provider-timeout', {
          operation,
          ...(timeoutMs !== undefined ? { timeoutMs } : {}),
          durationMs: Date.now() - startedAt,
        });
        throw new InvitationAiProviderError(
          'AI provider timed out.',
          'timeout',
          undefined,
          httpStatus,
          true
        );
      }
      this.diagnostic('provider-request-failure', {
        operation,
        durationMs: Date.now() - startedAt,
        errorType: error instanceof Error ? error.name : typeof error,
      });
      if (error instanceof TypeError) {
        throw new InvitationAiProviderError(
          'AI provider is unavailable.',
          'provider',
          undefined,
          httpStatus,
          true
        );
      }
      throw new InvitationAiProviderError(
        'AI provider returned invalid output.',
        'invalid-output',
        undefined,
        httpStatus,
        true
      );
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      signal?.removeEventListener('abort', onExternalAbort);
    }
  }

  private async withModelFallback<T>(
    operation: AiModelOperation,
    requestOperation: string,
    execute: (model: string) => Promise<T>,
    context: {
      invitationId?: string;
      stage?: () => string;
      modelPreference?: 'auto' | string;
    } = {}
  ): Promise<{ value: T; model: string }> {
    const models =
      this.providerName === 'openrouter'
        ? await this.modelRouting.candidatesForPreference(operation, context.modelPreference)
        : [this.model];
    let lastError: unknown;
    for (const [index, model] of models.entries()) {
      const startedAt = Date.now();
      const fallbackUsed =
        index > 0 ||
        (Boolean(context.modelPreference) &&
          context.modelPreference !== 'auto' &&
          model !== context.modelPreference);
      try {
        const value = await execute(model);
        this.diagnostic('model-route-attempt', {
          operation: requestOperation,
          ...(context.invitationId ? { invitationId: context.invitationId } : {}),
          model,
          attempt: index + 1,
          stage: context.stage?.() ?? 'provider-request',
          result: 'success',
          fallbackUsed,
          fallbackTriggered: false,
          failureCategory: 'none',
          durationMs: Date.now() - startedAt,
        });
        return { value, model };
      } catch (error) {
        lastError = error;
        const retryable = error instanceof InvitationAiProviderError && error.retryable;
        const category =
          error instanceof InvitationAiProviderError
            ? error.httpStatus === 402
              ? 'payment-required'
              : error.status === 'provider' && error.httpStatus === 429
                ? 'rate-limit'
                : error.status
            : 'internal-error';
        this.diagnostic('model-route-attempt', {
          operation: requestOperation,
          ...(context.invitationId ? { invitationId: context.invitationId } : {}),
          model,
          attempt: index + 1,
          stage: context.stage?.() ?? 'provider-request',
          result: 'failed',
          failureCategory: category,
          ...(error instanceof InvitationAiProviderError && error.httpStatus != null
            ? { httpStatus: error.httpStatus }
            : {}),
          fallbackUsed,
          fallbackTriggered: index < models.length - 1 && retryable,
          durationMs: Date.now() - startedAt,
        });
        if (!retryable || index === models.length - 1) throw error;
      }
    }
    throw lastError ?? new InvitationAiProviderError('AI provider request failed.', 'provider');
  }

  private invalidModelOutput(reason: string): never {
    this.diagnostic('model-output-validation-failure', { reason });
    throw new InvitationAiProviderError(
      'AI provider returned invalid output.',
      'invalid-output',
      undefined,
      null,
      true
    );
  }

  private parseWebsiteProject(value: unknown): GeneratedWebsiteProject {
    const normalized = this.normalizeWebsiteProject(value);
    if (!this.strictDesignValidation)
      return this.normalizeCompatibleWebsiteProject(normalized.project);
    const project = normalized.project as Partial<GeneratedWebsiteProject>;
    if (!project || typeof project !== 'object' || Array.isArray(project)) {
      return this.invalidProject('project-wrapper');
    }
    // Structural metadata only: key names, counts, and string lengths. Never
    // the model text itself, so the diagnostic stays safe to log.
    const structure = {
      projectKeyNames: Object.keys(project).sort().join(','),
      projectKeyCount: Object.keys(project).length,
      fileCount: Array.isArray(project.files) ? project.files.length : -1,
      nameIsString: typeof project.name === 'string',
      nameLength: typeof project.name === 'string' ? project.name.length : -1,
      descriptionIsString: typeof project.description === 'string',
      descriptionLength: typeof project.description === 'string' ? project.description.length : -1,
      fileKeyNames: Array.isArray(project.files)
        ? project.files
            .map((file) =>
              file && typeof file === 'object' && !Array.isArray(file)
                ? Object.keys(file).sort().join('+')
                : 'not-an-object'
            )
            .join('|')
        : 'files-not-an-array',
    };
    if (
      typeof project.name !== 'string' ||
      project.name.trim().length === 0 ||
      typeof project.description !== 'string' ||
      project.description.trim().length === 0 ||
      !Array.isArray(project.files) ||
      project.files.length !== 2
    ) {
      return this.invalidProject('project-fields', structure);
    }
    // The model may add its own keys. Unknown keys are simply not copied into
    // the stored project, so accepting them cannot widen what is persisted.
    const name = this.clampText(project.name, 120, 'name');
    const description = this.clampText(project.description, 300, 'description');
    const files = project.files.map((file) => {
      if (!file || typeof file !== 'object' || Array.isArray(file)) {
        return this.invalidProject('file-shape');
      }
      const source = file as { path?: unknown; content?: unknown };
      if (
        (source.path !== 'index.html' && source.path !== 'styles.css') ||
        typeof source.content !== 'string' ||
        !source.content.trim() ||
        source.content.length > (source.path === 'index.html' ? 30_000 : 25_000)
      ) {
        return this.invalidProject('file-fields', {
          ...structure,
          failingPath: typeof source.path === 'string' ? source.path : 'unknown',
          failingContentLength: typeof source.content === 'string' ? source.content.length : -1,
        });
      }
      return {
        path: source.path,
        content: source.content,
      } as GeneratedWebsiteProject['files'][number];
    });
    if (new Set(files.map((file) => file.path)).size !== 2) {
      return this.invalidProject('file-paths');
    }
    const html = files.find((file) => file.path === 'index.html')!.content;
    const css = files.find((file) => file.path === 'styles.css')!.content;
    if (
      /<\s*\/?(?:script|iframe|object|embed|form|input|button|svg|math|canvas|img|video|audio)\b|\bon[a-z]+\s*=|\b(?:src|href|action)\s*=|(?:javascript|vbscript|data)\s*:/i.test(
        html
      ) ||
      /(?:@import|url\s*\(|image-set\s*\(|expression\s*\(|javascript\s*:|data\s*:|https?\s*:|file\s*:|blob\s*:|-moz-binding|behavior\s*:)/i.test(
        css
      )
    ) {
      return this.invalidProject('unsafe-source');
    }
    return { name, description, files };
  }

  /**
   * Temporary compatibility normalizer. It accepts renderable HTML/CSS from
   * common response envelopes while leaving all size and executable-content
   * checks in place. The resulting artifact is still passed through the HTML
   * sanitizer before it can be saved or rendered.
   */
  private normalizeCompatibleWebsiteProject(value: unknown): GeneratedWebsiteProject {
    if (!isObject(value)) return this.invalidProject('project-wrapper');
    const htmlLimit = 30_000;
    const cssLimit = 25_000;
    const project = isObject(value.website)
      ? value.website
      : isObject(value.design)
        ? value.design
        : isObject(value.invitation)
          ? value.invitation
          : value;
    let html: unknown = project.html ?? project.body ?? project.markup;
    let css: unknown = project.css ?? project.styles ?? project.styleSheet;
    const title: unknown = project.name ?? project.title;
    const description: unknown = project.description ?? project.summary;

    if (Array.isArray(project.files)) {
      for (const item of project.files) {
        if (!isObject(item)) continue;
        const path = String(item.path ?? item.name ?? item.filename ?? '').toLowerCase();
        const content = item.content ?? item.code;
        if (typeof content !== 'string') continue;
        if (path.endsWith('.html') || path === 'html') html ??= content;
        if (path.endsWith('.css') || path === 'css') css ??= content;
      }
    } else if (isObject(project.files)) {
      html ??= project.files['index.html'] ?? project.files['html'];
      css ??= project.files['styles.css'] ?? project.files['css'];
    }

    if (typeof html !== 'string' || !html.trim() || html.length > htmlLimit) {
      return this.invalidProject('project-html');
    }
    const normalizedCss =
      typeof css === 'string' && css.trim() ? css : 'body{margin:0;font-family:serif}';
    if (normalizedCss.length > cssLimit) {
      return this.invalidProject('project-css');
    }
    const normalizedTitle = typeof title === 'string' && title.trim() ? title : 'Invitation';
    const normalizedDescription =
      typeof description === 'string' && description.trim() ? description : 'You are invited.';
    const safeTitle = this.clampText(normalizedTitle, 120, 'name');
    const safeDescription = this.clampText(normalizedDescription, 300, 'description');
    if (
      /<\s*\/?(?:script|iframe|object|embed|form|input|button|svg|math|canvas|img|video|audio)\b|\bon[a-z]+\s*=|\b(?:src|href|action)\s*=|(?:javascript|vbscript|data)\s*:/i.test(
        html
      ) ||
      /(?:@import|url\s*\(|image-set\s*\(|expression\s*\(|javascript\s*:|data\s*:|https?\s*:|file\s*:|blob\s*:|-moz-binding|behavior\s*:)/i.test(
        normalizedCss
      )
    ) {
      return this.invalidProject('unsafe-source');
    }
    return {
      name: safeTitle,
      description: safeDescription,
      files: [
        { path: 'index.html', content: html },
        { path: 'styles.css', content: normalizedCss },
      ],
    };
  }

  /**
   * OpenRouter models can return either the requested wrapper or the project
   * directly. Normalize only those two envelopes; all project constraints are
   * intentionally enforced below by the existing strict validator.
   */
  private normalizeWebsiteProject(value: unknown): { project: unknown } {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return this.invalidProject('root-shape');
    }
    const root = value as Record<string, unknown>;
    const hasWrapper = Object.prototype.hasOwnProperty.call(root, 'project');
    this.diagnostic('project-response-normalized', {
      shape: hasWrapper ? 'wrapped' : 'direct',
      rootKeys: Object.keys(root).sort(),
    });
    return { project: hasWrapper ? root.project : root };
  }

  protected parseModelJson(content: string, operation: string, startedAt: number): unknown {
    const trimmed = content.trim();
    // A model may return the JSON bare, in a fenced block, or wrapped in a
    // sentence. Only the exact JSON is ever used, and it is still validated
    // strictly afterwards, so recovering from formatting noise is safe.
    const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(trimmed);
    const candidates = [trimmed];
    if (fenced?.[1]?.trim()) candidates.unshift(fenced[1].trim());
    const braced = this.firstBalancedJsonObject(trimmed);
    if (braced) candidates.push(braced);

    for (const [index, source] of candidates.entries()) {
      try {
        const value = JSON.parse(source);
        this.diagnostic('model-json-parse-success', {
          operation,
          durationMs: Date.now() - startedAt,
          markdownFenceRemoved: Boolean(fenced),
          recoveredFromSurroundingText: index > 0,
        });
        return value;
      } catch {
        // Try the next candidate; a hard failure is reported once below.
      }
    }
    this.diagnostic('model-json-parse-failure', {
      operation,
      durationMs: Date.now() - startedAt,
      markdownFencePresent: Boolean(fenced),
      contentLength: content.length,
    });
    throw new InvitationAiProviderError(
      'AI provider returned invalid output.',
      'invalid-output',
      undefined,
      null,
      true
    );
  }

  /**
   * Returns the first brace-balanced JSON object in the text, ignoring braces
   * inside string literals and escape sequences. Returns null when the text
   * holds no complete object.
   */
  private firstBalancedJsonObject(text: string): string | null {
    const start = text.indexOf('{');
    if (start === -1) return null;
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let index = start; index < text.length; index += 1) {
      const character = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') inString = true;
      else if (character === '{') depth += 1;
      else if (character === '}') {
        depth -= 1;
        if (depth === 0) return text.slice(start, index + 1);
      }
    }
    return null;
  }

  /**
   * Keeps a descriptive string inside its storage bound instead of discarding a
   * whole generated website because a summary ran a few characters long. The
   * bound is still enforced, so this never widens what is stored.
   */
  private clampText(value: string, max: number, field: 'name' | 'description'): string {
    const trimmed = value.trim();
    if (trimmed.length <= max) return trimmed;
    this.diagnostic('project-text-clamped', {
      field,
      originalLength: trimmed.length,
      max,
    });
    return trimmed.slice(0, max).trim();
  }

  private invalidProject(
    category: string,
    structure?: Record<string, string | number | boolean>
  ): never {
    this.diagnostic(
      'project-validation-failure',
      structure ? { category, ...structure } : { category }
    );
    throw new InvitationAiProviderError(
      'AI provider returned invalid output.',
      'invalid-output',
      undefined,
      null,
      true
    );
  }

  protected diagnostic(
    event: string,
    metadata: Record<string, string | number | boolean | string[]> = {}
  ): void {
    if (!this.diagnosticsEnabled) return;
    this.logger.debug({ event, ...metadata });
  }

  private designSystemPrompt(): string {
    return [
      'You generate digital invitation design JSON only.',
      'Return a complete invitation design matching this JSON schema: ' +
        JSON.stringify(invitationDesignSchema),
      'Preserve the event title/date/venue truthfully. Do not invent venue logistics.',
      'For refine operations, modify the supplied currentDesign instead of creating an unrelated design.',
      'Do not include HTML, scripts, markdown, tracking URLs, or unsafe image URLs.',
      'Use only supported theme, font, section, and element values.',
      'Generate visual invitation content only. Never generate RSVP sections, forms, buttons, functionality, or logic; never generate countdown timers or displays, authentication, billing, or credits. RSVP is rendered separately by the application.',
      'Keep all text polished, concise, and suitable for a public invitation.',
    ].join(' ');
  }

  private smartQuestionSystemPrompt(): string {
    return [
      'You are the intake assistant for a premium event-invitation generator. Return JSON only.',
      'Decide whether the collected information is already enough to generate a high-quality invitation website. It is enough when the occasion and its key facts are clear and the AI can make sensible design decisions on the rest. It is not enough when something genuinely important for a good invitation is still unknown.',
      'Merge every useful fact from the original prompt, the previously collected data, and the user answers into collectedData. Never re-ask for something already present in collectedData or answers. Never invent a date, venue, host name, or RSVP policy that the user did not give or imply.',
      'The response must be a JSON object with three keys: status, collectedData, and question.',
      'Set status to READY when the collected information is already sufficient, and set question to null.',
      'Set status to QUESTION when a genuinely important detail is still missing, and include exactly one question object with the keys id, text, type, options, and allowOther. Never include more than one question.',
      'Rules for the question: choose type single_select when a few clear choices fit, multi_select only when several answers genuinely apply together, date for a calendar date, time for a clock time, and text for genuinely free-form input. Select types must include between 2 and 6 concrete options, generated from this specific event; non-select types must send an empty options array. Never include HTML, markdown, or code in text or options. Set allowOther true to let the user type a custom answer.',
      'Ask in priority order: event type, then the people or host, then the date, then the time, then the place, then the visual style or mood. Skip anything already known and skip anything the AI could reasonably decide itself without hurting quality.',
      'If lastQuestionId is set, do not ask that question again.',
    ].join(' ');
  }

  private websiteSystemPrompt(isRefinement: boolean): string {
    return [
      'Return JSON only, in exactly this shape: {"project":{"name":"plain title","description":"plain summary","files":[{"path":"index.html","content":"HTML body fragment"},{"path":"styles.css","content":"CSS"}]}}.',
      'The project object must contain only name, description, and files. Each file object must contain only path and content. Use exactly two files: one with path "index.html" and one with path "styles.css".',
      'Keep name at 100 characters or fewer and description at 240 characters or fewer.',
      'Generate a real, standalone, premium event-invitation website project, not an editor, dashboard, or marketing page.',
      'The HTML must be a semantic body fragment and CSS must be self-contained. Focus only on visual design, layout, typography, colors, decorative elements, and user-requested invitation content.',
      'Keep the two-file project compact: combined source must stay below 14000 characters, with HTML below 9500 characters and CSS below 4500 characters. Stay well inside that budget so the response is never cut off before it is complete.',
      'Prioritize exceptional visual hierarchy, accessible contrast, clean typography, responsive mobile/tablet/desktop layout, tasteful CSS-only animations, consistent spacing, and no horizontal overflow.',
      'Do not use React, JavaScript, TypeScript, scripts, event handlers, forms, iframe, SVG, canvas, images, links, external resources, @import, url(), network requests, credentials, secrets, APIs, shell commands, filesystem access, or tracking.',
      'Do not generate backend code or anything that can access cookies, local storage, the parent application, authentication, or a preview sandbox escape.',
      'Never generate RSVP sections, forms, buttons, controls, functionality, or logic. Never generate countdown timers or countdown displays, authentication, billing, or credits. The SaaS injects its RSVP form separately outside the generated invitation document.',
      'Preserve supplied event facts truthfully. Do not invent dates, venues, addresses, or logistics.',
      isRefinement
        ? 'Modify the supplied currentProject to fulfill the refinement prompt. Keep unrelated layout and content intact whenever possible.'
        : 'Create the invitation from the supplied prompt and event facts.',
    ].join(' ');
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
