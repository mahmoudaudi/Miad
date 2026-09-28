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
  publishedDesignVersion?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type AiStudioModelOption = {
  id: string;
  name: string;
  description: string;
  operations: Array<
    | 'generation'
    | 'refinement'
    | 'smart-questions'
    | 'image-planning'
    | 'design-validation'
    | 'future'
  >;
  tier: 'standard' | 'premium';
  available: boolean;
};

export type AiStudioModelConfiguration = { models: AiStudioModelOption[] };

export const getAiStudioModels = () =>
  authenticatedApiClient<AiStudioModelConfiguration>('/ai/models');

const modelPreferenceStorageKey = (userId: string) => `ai-studio-model:${userId}`;

export function readAiStudioModelPreference(userId: string, models: AiStudioModelOption[]): string {
  if (typeof window === 'undefined') return 'auto';
  try {
    const preference = window.localStorage.getItem(modelPreferenceStorageKey(userId)) ?? 'auto';
    return preference === 'auto' ||
      models.some((model) => model.id === preference && model.available)
      ? preference
      : 'auto';
  } catch {
    return 'auto';
  }
}

export function saveAiStudioModelPreference(
  userId: string,
  preference: string,
  models: AiStudioModelOption[]
): boolean {
  if (
    typeof window === 'undefined' ||
    (preference !== 'auto' && !models.some((model) => model.id === preference && model.available))
  ) {
    return false;
  }
  try {
    window.localStorage.setItem(modelPreferenceStorageKey(userId), preference);
    return true;
  } catch {
    return false;
  }
}

export type AiStudioResult = {
  event: AiStudioEvent;
  invitation: AiStudioInvitation;
  design: InvitationHtmlDesignRecord | null;
  aiError: string | null;
};

export type AiStudioComposerImage = {
  id: string;
  scope: 'pending' | 'invitation';
};

export type AiStudioComposerSubmission<TImage extends AiStudioComposerImage> = {
  prompt: string;
  generationContext: string;
  images: TImage[];
  selectedImageIds: string[];
};

/**
 * Keeps the visible composer independent from the request already in flight.
 * The snapshot survives while the input/previews are cleared and is restored
 * verbatim if generation fails.
 */
export function captureAiStudioComposerSubmission<TImage extends AiStudioComposerImage>(
  prompt: string,
  generationContext: string,
  images: TImage[]
): AiStudioComposerSubmission<TImage> {
  return {
    prompt,
    generationContext,
    images: [...images],
    selectedImageIds: images.map((image) => image.id),
  };
}

/** Marks pending images that the backend attached before a later generation failure. */
export function restoreAiStudioComposerSubmission<TImage extends AiStudioComposerImage>(
  submission: AiStudioComposerSubmission<TImage>,
  claimedImageIds: string[] = []
): { prompt: string; images: TImage[] } {
  const claimed = new Set(claimedImageIds);
  return {
    prompt: submission.prompt,
    images: submission.images.map((image) =>
      claimed.has(image.id) ? ({ ...image, scope: 'invitation' } as TImage) : image
    ),
  };
}

export const aiGenerationStages = [
  'REQUEST_RECEIVED',
  'ANALYZING_EVENT',
  'GENERATING_WEBSITE',
  'PARSING_RESPONSE',
  'VALIDATING_WEBSITE',
  'SAVING_WEBSITE',
  'REFINEMENT_UNDERSTANDING',
  'REFINEMENT_INSPECTING',
  'REFINEMENT_APPLYING',
  'REFINEMENT_VALIDATING',
  'REFINEMENT_SAVING',
  'REFINEMENT_PREVIEW_UPDATED',
  'COMPLETED',
] as const;

export type AiGenerationStage = (typeof aiGenerationStages)[number];
export type AiGenerationProgress = {
  generationId: string;
  operation?: 'generation' | 'refinement';
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
export const generateAiStudio = (
  prompt: string,
  generationId?: string,
  signal?: AbortSignal,
  modelPreference: 'auto' | string = 'auto',
  imageIds: string[] = []
) =>
  authenticatedApiClient<AiStudioResult>('/ai/generate', {
    method: 'POST',
    body: JSON.stringify({
      prompt,
      modelPreference,
      ...(generationId ? { generationId } : {}),
      ...(imageIds.length ? { imageIds } : {}),
    }),
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
    generationId?: string;
    modelPreference?: 'auto' | string;
    imageIds?: string[];
  },
  signal?: AbortSignal
) =>
  authenticatedApiClient<InvitationHtmlDesignRecord>('/ai/refine', {
    method: 'POST',
    body: JSON.stringify(input),
    ...(signal ? { signal } : {}),
  });

export function aiStudioProjectHref(invitationId: string): string {
  return `/dashboard/invitations/new?invitationId=${encodeURIComponent(invitationId)}`;
}

export function invitationDesignPreviewUrl(invitationId: string, version: number): string {
  return `/api/designs/${encodeURIComponent(invitationId)}/render?version=${version}`;
}

export function getAiStudioProjectId(searchParams: {
  get(name: string): string | null;
}): string | null {
  const invitationId = searchParams.get('invitationId')?.trim();
  return invitationId || null;
}

/**
 * AI Studio route with any invitationId removed, preserving all other query
 * params. Used when the authenticated identity changes so the next account
 * can never inherit the previous account's project from the URL.
 */
export function aiStudioUrlWithoutInvitation(search: string): string {
  const params = new URLSearchParams(search.replace(/^\?/, ''));
  params.delete('invitationId');
  const qs = params.toString();
  return `/dashboard/invitations/new${qs ? `?${qs}` : ''}`;
}

export type StudioSessionTransition = 'init' | 'keep' | 'reset';

/**
 * Decides what happens to loaded studio state when an identity is observed:
 * first observation only records it ('init'), the same user keeps everything
 * ('keep'), and a different user must drop all previous-user state ('reset')
 * so Account B can never continue seeing Account A's project, messages,
 * canvas, or publish URL.
 */
export function resolveStudioSessionTransition(
  loadedUserId: string | null,
  observedUserId: string
): StudioSessionTransition {
  if (loadedUserId === null) return 'init';
  return loadedUserId === observedUserId ? 'keep' : 'reset';
}

export type AiStudioRequestMode = 'initial-analysis' | 'existing-refinement' | 'existing-analysis';

/**
 * Only vague requests with no actionable direction need a Smart Question for
 * an existing project. Specific edits can be applied against its saved design.
 */
export function isAmbiguousRefinementRequest(prompt: string): boolean {
  const normalized = prompt
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ');
  return /^(?:please )?(?:make it(?: better)?|make this(?: better)?|change it|change this|fix it|fix this|improve it|improve this|update it|update this|do it|make it pop|make it nice)$/.test(
    normalized
  );
}

/** Mirrors the server's conservative gate; the server remains authoritative. */
export function explicitlyRequestsUploadedImages(prompt: string): boolean {
  const text = prompt.toLowerCase().replace(/\s+/g, ' ');
  const action = '(?:use|include|feature|place|add|show|incorporate|with)';
  const selected = '(?:this|these|my|our|the uploaded|uploaded|attached|selected|provided)';
  const image = '(?:photo|photos|photograph|photographs|image|images|picture|pictures)';
  return (
    new RegExp(`${action}[^.!?\\n]{0,50}${selected}\\s+${image}`, 'i').test(text) ||
    new RegExp(`${selected}\\s+${image}[^.!?\\n]{0,50}${action}`, 'i').test(text)
  );
}

export function resolveAiStudioRequestMode(input: {
  invitationId: string | null;
  prompt: string;
  questionFlowActive?: boolean;
}): AiStudioRequestMode {
  if (!input.invitationId) return 'initial-analysis';
  if (input.questionFlowActive || isAmbiguousRefinementRequest(input.prompt)) {
    return 'existing-analysis';
  }
  return 'existing-refinement';
}

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

export type SmartAnswer = {
  questionId: string;
  value: SmartAnswerValue;
  /** Client-only label retained so generation never depends on the analyzer re-serializing an answer. */
  question?: string;
};

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
  modelPreference?: 'auto' | string;
  signal?: AbortSignal;
}) =>
  authenticatedApiClient<SmartAnalysis>('/ai/analyze', {
    method: 'POST',
    body: JSON.stringify({
      prompt: input.prompt,
      ...(input.collectedData ? { collectedData: input.collectedData } : {}),
      ...(input.answers?.length
        ? {
            answers: input.answers.map(({ questionId, value }) => ({ questionId, value })),
          }
        : {}),
      ...(input.lastQuestionId ? { lastQuestionId: input.lastQuestionId } : {}),
      modelPreference: input.modelPreference ?? 'auto',
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
  collectedData: SmartCollectedData | null | undefined,
  answers: SmartAnswer[] = []
): string {
  const prompt = originalPrompt.trim();
  const lines: string[] = [];
  if (collectedData) {
    for (const [key, label] of Object.entries(COLLECTED_LABELS)) {
      const formatted = formatCollectedValue(key, collectedData[key]);
      if (formatted) lines.push(`${label}: ${formatted}`);
    }
  }
  for (const answer of answers) {
    const formatted = formatCollectedValue(answer.questionId, answer.value);
    if (!formatted) continue;
    const label =
      answer.question?.trim() || COLLECTED_LABELS[answer.questionId] || answer.questionId;
    const line = `${label}: ${formatted}`;
    if (!lines.includes(line)) lines.push(line);
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

/** Resolves stored invitation image references through the latest preview-URL map. */
export function resolveInvitationImageElements(
  specification: InvitationDesignSpecification,
  previews: Record<string, string>
): InvitationDesignSpecification {
  const elements = (specification.elements ?? []).map((element) => {
    if (element.type !== 'image' || typeof element.imageUrl !== 'string') return element;
    const match = /^(?:image|media):\/\/([0-9a-fA-F-]{36})$/.exec(element.imageUrl);
    if (!match) return element;
    const preview = previews[match[1] ?? ''];
    return preview ? { ...element, imageUrl: preview } : element;
  });
  return { ...specification, elements };
}
