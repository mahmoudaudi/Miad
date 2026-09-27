import { HttpException } from '@nestjs/common';
import type { HtmlArtifactEnvelope } from './html-artifact';
import type {
  InvitationDesignSpecification,
  InvitationElement,
  InvitationSection,
} from './invitation-designs.service';

export const INVITATION_AI_PROVIDER = 'INVITATION_AI_PROVIDER';

export type InvitationAiOperation = 'generate' | 'regenerate' | 'refine';

export type InvitationAiEventContext = {
  title: string;
  eventType: string;
  description: string | null;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  venueName: string | null;
  venueAddress: string | null;
};

export type InvitationAiGenerateInput = {
  operation: InvitationAiOperation;
  prompt: string;
  event: InvitationAiEventContext;
  currentDesign: InvitationDesignSpecification | null;
};

export type InvitationHtmlAiGenerateInput = {
  prompt: string;
  event: InvitationAiEventContext;
  onProgress?: (stage: 'PARSING_RESPONSE' | 'VALIDATING_WEBSITE') => void;
  /**
   * Caller-owned cancellation (e.g. the client disconnected its generation
   * request). Aborting only stops the provider call — it is never reported
   * as a provider failure and never persists a design.
   */
  signal?: AbortSignal;
};

/**
 * The executable invitation source is intentionally limited to static files.
 * This is enough to be a real website project while allowing the runtime
 * preview to deny scripts, network access, cookies, and parent-window access.
 */
export type GeneratedWebsiteProject = {
  name: string;
  description: string;
  files: Array<{
    path: 'index.html' | 'styles.css';
    content: string;
  }>;
};

export type InvitationAiResult = {
  specification: Partial<
    InvitationDesignSpecification & {
      sections: Partial<InvitationSection>[];
      elements: Partial<InvitationElement>[];
    }
  >;
  tokensUsed: number | null;
  provider: string;
  model: string;
};

export type InvitationHtmlAiResult = {
  artifact: Omit<HtmlArtifactEnvelope, 'format' | 'version'>;
  project: GeneratedWebsiteProject;
  tokensUsed: number | null;
  provider: string;
  model: string;
};

/** Loose extraction output — AiStudioService validates and clamps everything. */
export type InvitationAiEventDetails = {
  title?: unknown;
  eventType?: unknown;
  eventDate?: unknown;
  venueName?: unknown;
};

/**
 * Raw Smart Question Flow analysis from the model. Deliberately `unknown`:
 * the service must validate this strictly before it can reach a client.
 */
export type InvitationAiAnalysisRequest = {
  prompt: string;
  collectedData: Record<string, unknown>;
  answers: Array<{ questionId: string; value: string | string[] | null }>;
  /** The question most recently asked, so the AI does not repeat it. */
  lastQuestionId?: string;
  signal?: AbortSignal;
};

export interface InvitationAiProvider {
  generateDesign(input: InvitationAiGenerateInput): Promise<InvitationAiResult>;
  generateHtml(input: InvitationHtmlAiGenerateInput): Promise<InvitationHtmlAiResult>;
  refineHtml(input: {
    prompt: string;
    event: InvitationAiEventContext;
    project: GeneratedWebsiteProject;
    signal?: AbortSignal;
  }): Promise<InvitationHtmlAiResult>;
  extractEventDetails(prompt: string): Promise<InvitationAiEventDetails>;
  /** Returns the raw model analysis; the caller validates it strictly. */
  analyzeDetails(input: InvitationAiAnalysisRequest): Promise<unknown>;
}

export class InvitationAiProviderError extends Error {
  constructor(
    message: string,
    readonly status: 'configuration' | 'timeout' | 'provider' | 'invalid-output',
    readonly cause?: unknown
  ) {
    super(message);
  }
}

/**
 * The caller cancelled its own generation request (client disconnect / STOP).
 * This is not a provider failure: no failure telemetry is recorded, no
 * failure progress is emitted, and no design is persisted.
 * Status 499 (Client Closed Request) is conventional, never a 5xx.
 */
export class AiGenerationCancelledError extends HttpException {
  constructor() {
    super('AI generation was cancelled.', 499);
  }
}
