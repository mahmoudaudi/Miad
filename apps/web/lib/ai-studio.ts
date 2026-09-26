import { authenticatedApiClient } from './api-client';
import { getApiUrl } from './env';
import type {
  GeneratedWebsiteProject,
  InvitationDesignSpecification,
  InvitationHtmlDesignRecord,
} from './invitation-designs';

export type AiStudioEvent = {
  id: string;
  title: string;
  eventType: string;
  eventDate: string;
  venueName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiStudioInvitation = {
  id: string;
  eventId: string;
  slug: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiStudioResult = {
  event: AiStudioEvent;
  invitation: AiStudioInvitation;
  design: InvitationHtmlDesignRecord | null;
  aiError: string | null;
};

export const aiGenerationStages = [
  'REQUEST_RECEIVED',
  'ANALYZING_EVENT',
  'GENERATING_WEBSITE',
  'PARSING_RESPONSE',
  'VALIDATING_WEBSITE',
  'SAVING_WEBSITE',
  'COMPLETED',
] as const;

export type AiGenerationStage = (typeof aiGenerationStages)[number];
export type AiGenerationProgress = {
  generationId: string;
  stage: AiGenerationStage;
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED';
  occurredAt: string;
  errorMessage?: string;
};

/**
 * One-shot prompt → event + invitation + design.
 * Always persists (201); a null design with aiError means generation failed
 * and can be retried per-invitation without losing anything.
 */
export const generateAiStudio = (prompt: string, generationId?: string, signal?: AbortSignal) =>
  authenticatedApiClient<AiStudioResult>('/ai/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt, ...(generationId ? { generationId } : {}) }),
    ...(signal ? { signal } : {}),
  });

export function createAiGenerationId(): string {
  return crypto.randomUUID();
}

export function observeAiGeneration(
  generationId: string,
  onProgress: (progress: AiGenerationProgress) => void
): () => void {
  if (typeof EventSource === 'undefined') return () => undefined;
  const base = getApiUrl().replace(/\/$/, '');
  const source = new EventSource(
    `${base}/ai/generation-progress/${encodeURIComponent(generationId)}`,
    {
      withCredentials: true,
    }
  );
  source.addEventListener('progress', (event: MessageEvent<string>) => {
    try {
      const progress = JSON.parse(event.data) as AiGenerationProgress;
      if (progress.generationId !== generationId) return;
      onProgress(progress);
      if (progress.status !== 'ACTIVE') source.close();
    } catch {
      // A malformed progress event must not invent or alter a stage in the UI.
    }
  });
  return () => source.close();
}

export const refineAiStudio = (
  input: {
    invitationId: string;
    website: GeneratedWebsiteProject;
    prompt: string;
  },
  signal?: AbortSignal
) =>
  authenticatedApiClient<InvitationHtmlDesignRecord>('/ai/refine', {
    method: 'POST',
    body: JSON.stringify(input),
    ...(signal ? { signal } : {}),
  });

// ---------------------------------------------------------------------------
// Smart Question Flow
// ---------------------------------------------------------------------------

export const smartQuestionTypes = [
  'single_select',
  'multi_select',
  'text',
  'date',
  'time',
] as const;

export type SmartQuestionType = (typeof smartQuestionTypes)[number];

export type SmartQuestionOption = { label: string; value: string };

export type SmartQuestion = {
  id: string;
  text: string;
  type: SmartQuestionType;
  options: SmartQuestionOption[];
  allowOther: boolean;
};

export type SmartCollectedData = Record<string, unknown> & {
  eventType?: string;
  title?: string;
  names?: string[];
  date?: string;
  time?: string;
  location?: string;
  venue?: string;
  style?: string;
  colors?: string[];
  tone?: string;
  message?: string;
  rsvpRequired?: boolean;
};

export type SmartAnswerValue = string | string[] | null;

export type SmartAnswer = { questionId: string; value: SmartAnswerValue };

export type SmartAnalysis =
  | { status: 'READY'; collectedData: SmartCollectedData; question: null }
  | { status: 'QUESTION'; collectedData: SmartCollectedData; question: SmartQuestion };

/**
 * Asks the assistant whether there is enough to generate with, and returns
 * either the merged brief or exactly one next question. It creates nothing.
 */
export const analyzeAiStudio = (input: {
  prompt: string;
  collectedData?: SmartCollectedData;
  answers?: SmartAnswer[];
  lastQuestionId?: string;
  signal?: AbortSignal;
}) =>
  authenticatedApiClient<SmartAnalysis>('/ai/analyze', {
    method: 'POST',
    body: JSON.stringify({
      prompt: input.prompt,
      ...(input.collectedData ? { collectedData: input.collectedData } : {}),
      ...(input.answers?.length ? { answers: input.answers } : {}),
      ...(input.lastQuestionId ? { lastQuestionId: input.lastQuestionId } : {}),
    }),
    ...(input.signal ? { signal: input.signal } : {}),
  });

const COLLECTED_LABELS: Record<string, string> = {
  eventType: 'Event type',
  title: 'Title',
  names: 'Names',
  date: 'Date',
  time: 'Time',
  location: 'Location',
  venue: 'Venue',
  style: 'Style',
  colors: 'Colors',
  tone: 'Tone',
  message: 'Message',
  rsvpRequired: 'RSVP required',
};

function formatCollectedValue(key: string, value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) {
    const list = value.filter((item) => typeof item === 'string' && item.trim());
    return list.length ? list.join(', ') : null;
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (key === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      });
    }
  }
  return trimmed;
}

/**
 * Merges the original prompt and the collected brief into the single context
 * string handed to the existing generation endpoint. Generation itself is
 * untouched — this only enriches its prompt.
 */
export function buildGenerationContext(
  originalPrompt: string,
  collectedData: SmartCollectedData | null | undefined
): string {
  const prompt = originalPrompt.trim();
  if (!collectedData || Object.keys(collectedData).length === 0) return prompt;
  const lines: string[] = [];
  for (const [key, label] of Object.entries(COLLECTED_LABELS)) {
    const formatted = formatCollectedValue(key, collectedData[key]);
    if (formatted) lines.push(`${label}: ${formatted}`);
  }
  if (lines.length === 0) return prompt;
  return [
    'Original request:',
    prompt,
    '',
    'Additional information collected from the user:',
    ...lines,
    '',
    'Use these details when generating the invitation. Do not invent details that contradict them.',
  ].join('\n');
}

/**
 * Pure helper: points the hero photo at an image URL. Reuses the first
 * image element when the spec already has one, otherwise appends a
 * top-banner photo element with safe default geometry.
 */
export function withHeroImage(
  specification: InvitationDesignSpecification,
  imageUrl: string
): InvitationDesignSpecification {
  const elements = [...(specification.elements ?? [])];
  const index = elements.findIndex((element) => element.type === 'image');
  const current = index >= 0 ? elements[index] : undefined;
  if (current) {
    elements[index] = { ...current, imageUrl };
    return { ...specification, elements };
  }
  return {
    ...specification,
    elements: [
      ...elements,
      {
        id: 'photo-hero',
        type: 'image',
        label: 'Photo',
        imageUrl,
        x: 10,
        y: 0,
        width: 80,
        height: 34,
        fontSize: 16,
        color: specification.colors.text,
      },
    ],
  };
}

/** Resolves `media://{id}` element references through a preview-URL map. */
export function resolveMediaElements(
  specification: InvitationDesignSpecification,
  previews: Record<string, string>
): InvitationDesignSpecification {
  const elements = (specification.elements ?? []).map((element) => {
    if (element.type !== 'image' || typeof element.imageUrl !== 'string') return element;
    const match = /^media:\/\/([0-9a-fA-F-]{36})$/.exec(element.imageUrl);
    if (!match) return element;
    const preview = previews[match[1] ?? ''];
    return preview ? { ...element, imageUrl: preview } : element;
  });
  return { ...specification, elements };
}
