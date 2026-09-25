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

export interface InvitationAiProvider {
  generateDesign(input: InvitationAiGenerateInput): Promise<InvitationAiResult>;
  generateHtml(input: InvitationHtmlAiGenerateInput): Promise<InvitationHtmlAiResult>;
  extractEventDetails(prompt: string): Promise<InvitationAiEventDetails>;
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
