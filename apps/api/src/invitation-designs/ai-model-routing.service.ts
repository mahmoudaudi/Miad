import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AiModelOperation =
  | 'generation'
  | 'refinement'
  | 'smart-questions'
  | 'image-planning'
  | 'design-validation'
  | 'future';

type OperationConfig = {
  key: string;
  defaultPrimary: string;
  defaultFallbacks: string[];
};

export type AiStudioModelPreference = 'auto' | string;

export type AiStudioModelOption = {
  id: string;
  name: string;
  description: string;
  operations: AiModelOperation[];
  tier: 'standard' | 'premium';
  available: boolean;
};

const SELECTABLE_MODELS: Omit<AiStudioModelOption, 'available'>[] = [
  {
    id: 'deepseek/deepseek-v4.1-flash',
    name: 'DeepSeek V4.1 Flash',
    description: 'Cost-efficient model',
    operations: [
      'generation',
      'refinement',
      'smart-questions',
      'image-planning',
      'design-validation',
    ],
    tier: 'standard',
  },
  {
    id: 'qwen/qwen3-coder-next',
    name: 'Qwen3 Coder Next',
    description: 'Optimized for coding tasks',
    operations: ['generation', 'refinement', 'smart-questions', 'design-validation'],
    tier: 'standard',
  },
  {
    id: 'anthropic/claude-opus-5.5',
    name: 'Claude Opus 5.5',
    description: 'Premium',
    operations: [
      'generation',
      'refinement',
      'smart-questions',
      'image-planning',
      'design-validation',
    ],
    tier: 'premium',
  },
  {
    id: 'openai/gpt-6-luna',
    name: 'GPT-6 Luna',
    description: 'Fast, cost-efficient tier',
    operations: [
      'generation',
      'refinement',
      'smart-questions',
      'image-planning',
      'design-validation',
    ],
    tier: 'standard',
  },
  {
    id: 'mistralai/mistral-large',
    name: 'Mistral Large',
    description: 'General-purpose model',
    operations: ['generation', 'refinement', 'smart-questions', 'design-validation'],
    tier: 'standard',
  },
];

const OPERATION_COMPATIBILITY: Record<AiModelOperation, string[]> = {
  generation: [...SELECTABLE_MODELS.map((model) => model.id), 'google/gemini-3.8-flash'],
  refinement: [...SELECTABLE_MODELS.map((model) => model.id), 'google/gemini-3.8-flash'],
  'smart-questions': [
    ...SELECTABLE_MODELS.map((model) => model.id),
    'google/gemini-3.5-flash-lite',
  ],
  'image-planning': [
    'deepseek/deepseek-v4.1-flash',
    'anthropic/claude-opus-5.5',
    'openai/gpt-6-luna',
    'google/gemini-3.8-flash',
  ],
  'design-validation': [...SELECTABLE_MODELS.map((model) => model.id), 'google/gemini-3.8-flash'],
  future: ['deepseek/deepseek-v4.1-flash', 'google/gemini-3.8-flash'],
};

/** One server-side source of model assignments and bounded fallback order. */
export const AI_MODEL_OPERATIONS: Record<AiModelOperation, OperationConfig> = {
  generation: {
    key: 'GENERATION',
    defaultPrimary: 'deepseek/deepseek-v4.1-flash',
    defaultFallbacks: ['google/gemini-3.8-flash', 'qwen/qwen3-coder-next'],
  },
  refinement: {
    key: 'REFINEMENT',
    defaultPrimary: 'google/gemini-3.8-flash',
    defaultFallbacks: ['deepseek/deepseek-v4.1-flash', 'qwen/qwen3-coder-next'],
  },
  'smart-questions': {
    key: 'SMART_QUESTIONS',
    defaultPrimary: 'google/gemini-3.5-flash-lite',
    defaultFallbacks: ['deepseek/deepseek-v4.1-flash'],
  },
  'image-planning': {
    key: 'IMAGE_PLANNING',
    defaultPrimary: 'google/gemini-3.8-flash',
    defaultFallbacks: ['deepseek/deepseek-v4.1-flash', 'qwen/qwen3-coder-next'],
  },
  'design-validation': {
    key: 'VALIDATION',
    defaultPrimary: 'deepseek/deepseek-v4.1-flash',
    defaultFallbacks: ['google/gemini-3.8-flash'],
  },
  future: {
    key: 'FUTURE',
    defaultPrimary: 'deepseek/deepseek-v4.1-flash',
    defaultFallbacks: ['google/gemini-3.8-flash'],
  },
};

@Injectable()
export class AiModelRoutingService {
  private availabilityCache: { expiresAt: number; ids: Set<string> } | null = null;
  private availabilityRequest: Promise<Set<string>> | null = null;

  constructor(private readonly config: ConfigService) {}

  candidates(operation: AiModelOperation): string[] {
    const route = AI_MODEL_OPERATIONS[operation];
    const operationSuffix = `${camelKey(route.key).charAt(0).toUpperCase()}${camelKey(route.key).slice(1)}`;
    const primary =
      this.read(`openrouterModel${operationSuffix}`) ??
      // Keep the former single-model setting as the generation primary for
      // deployments that have not yet set the per-operation variables.
      (operation === 'generation' ? this.read('openrouterModel') : undefined) ??
      route.defaultPrimary;
    const fallbacks = this.read(`openrouterModel${operationSuffix}Fallbacks`);
    const configuredFallbacks = splitModels(fallbacks);
    const fallbackModels = configuredFallbacks.length
      ? configuredFallbacks
      : route.defaultFallbacks;
    return [...new Set([primary, ...fallbackModels].map((model) => model.trim()).filter(Boolean))];
  }

  async modelOptions(): Promise<{ models: AiStudioModelOption[] }> {
    const available = await this.availableModelIds();
    return {
      models: SELECTABLE_MODELS.map((model) => ({
        ...model,
        available: available.has(model.id),
      })),
    };
  }

  async candidatesForPreference(
    operation: AiModelOperation,
    preference: AiStudioModelPreference = 'auto'
  ): Promise<string[]> {
    if (preference === 'auto' || preference === undefined || preference === '') {
      return this.candidates(operation);
    }

    const selected = SELECTABLE_MODELS.find((model) => model.id === preference);
    if (!selected) throw new BadRequestException('The selected AI model is not approved.');
    if (!selected.operations.includes(operation)) {
      throw new BadRequestException('The selected AI model is not available for this operation.');
    }

    const available = await this.availableModelIds();
    const automaticFallbacks = this.candidates(operation).filter(
      (model, index, models) =>
        model !== preference &&
        models.indexOf(model) === index &&
        OPERATION_COMPATIBILITY[operation].includes(model) &&
        available.has(model)
    );
    return [...(available.has(preference) ? [preference] : []), ...automaticFallbacks];
  }

  private async availableModelIds(): Promise<Set<string>> {
    if (this.availabilityCache && this.availabilityCache.expiresAt > Date.now()) {
      return this.availabilityCache.ids;
    }
    if (this.availabilityRequest) return this.availabilityRequest;

    const apiKey = this.read('openrouterApiKey') ?? this.read('OPENROUTER_API_KEY');
    if (!apiKey) return new Set();
    const base = (
      this.read('openrouterBaseUrl') ??
      this.read('OPENROUTER_BASE_URL') ??
      'https://openrouter.ai/api/v1'
    ).replace(/\/$/, '');

    this.availabilityRequest = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);
      try {
        const response = await fetch(`${base}/models/user`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: controller.signal,
        });
        if (!response.ok)
          throw new ServiceUnavailableException('AI model availability is unavailable.');
        const result: unknown = await response.json();
        const data =
          result && typeof result === 'object' && 'data' in result
            ? (result as { data?: unknown }).data
            : null;
        if (!Array.isArray(data)) {
          throw new ServiceUnavailableException('AI model availability is unavailable.');
        }
        const ids = new Set(
          data.flatMap((item: unknown) =>
            item && typeof item === 'object' && 'id' in item && typeof item.id === 'string'
              ? [item.id]
              : []
          )
        );
        this.availabilityCache = { ids, expiresAt: Date.now() + 60_000 };
        return ids;
      } catch (error) {
        if (error instanceof ServiceUnavailableException) throw error;
        throw new ServiceUnavailableException('AI model availability is unavailable.');
      } finally {
        clearTimeout(timeout);
        this.availabilityRequest = null;
      }
    })();
    return this.availabilityRequest;
  }

  private read(key: string): string | undefined {
    const value =
      this.config.get<string>(key) ??
      this.config.get<string>(key.replace(/([A-Z])/g, '_$1').toUpperCase());
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}

function camelKey(key: string): string {
  return key.toLowerCase().replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function splitModels(value: string | undefined): string[] {
  return (
    value
      ?.split(',')
      .map((model) => model.trim())
      .filter(Boolean) ?? []
  );
}
