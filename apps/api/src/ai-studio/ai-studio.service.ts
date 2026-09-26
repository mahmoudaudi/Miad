import {
  BadGatewayException,
  ConflictException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  INVITATION_AI_PROVIDER,
  AiGenerationCancelledError,
  type InvitationAiProvider,
} from '../invitation-designs/ai-provider.types';
import {
  InvitationDesignsService,
  type InvitationHtmlDesignResponse,
} from '../invitation-designs/invitation-designs.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  AiGenerationProgressService,
  type AiGenerationStage,
} from './ai-generation-progress.service';
import {
  parseSmartAnalysis,
  type SmartAnalysis,
} from './smart-question.types';
import type { AnalyzeAiStudioDto } from './dto/analyze-ai-studio.dto';

export type AiStudioEventResponse = {
  id: string;
  title: string;
  eventType: string;
  eventDate: string;
  venueName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiStudioInvitationResponse = {
  id: string;
  eventId: string;
  slug: string;
  status: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiStudioResponse = {
  event: AiStudioEventResponse;
  invitation: AiStudioInvitationResponse;
  design: InvitationHtmlDesignResponse | null;
  aiError: string | null;
};

export type AiStudioRefineResponse = InvitationHtmlDesignResponse;

export type AiStudioAnalyzeResponse = SmartAnalysis;

const EVENT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Never logs a provider message body — only the error class name. */
function errorName(error: unknown): string {
  return error instanceof Error ? error.name : typeof error;
}

/**
 * One-shot prompt → event + invitation + design.
 * Persistence never depends on AI: the event and invitation are created in
 * their own transaction first, and design generation runs afterwards as a
 * best-effort step (same Phase 1 guarantee as the manual creation flow).
 * No Prisma transaction is ever held open while waiting for the provider.
 */
@Injectable()
export class AiStudioService {
  private readonly logger = new Logger(AiStudioService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly designs: InvitationDesignsService,
    @Inject(INVITATION_AI_PROVIDER) private readonly aiProvider: InvitationAiProvider,
    @Optional() private readonly progress?: AiGenerationProgressService
  ) {}

  async createFromPrompt(
    userId: string,
    prompt: string,
    generationId?: string,
    signal?: AbortSignal
  ): Promise<AiStudioResponse> {
    const updateProgress = (
      stage: Exclude<AiGenerationStage, 'REQUEST_RECEIVED' | 'COMPLETED'>
    ) => {
      if (generationId) this.progress?.advance(userId, generationId, stage);
    };
    if (generationId) this.progress?.begin(userId, generationId);
    updateProgress('ANALYZING_EVENT');
    const details = await this.resolveEventDetails(prompt);
    const slug = this.invitationSlug(details.title);

    let event;
    let invitation;
    try {
      ({ event, invitation } = await this.prisma.$transaction(async (tx) => {
        const createdEvent = await tx.event.create({
          data: {
            userId,
            title: details.title,
            eventType: details.eventType,
            description: prompt,
            eventDate: details.eventDate,
            startTime: null,
            endTime: null,
            venueName: details.venueName,
            venueAddress: null,
            latitude: null,
            longitude: null,
          },
        });
        const createdInvitation = await tx.invitation.create({
          data: {
            eventId: createdEvent.id,
            slug,
            status: 'DRAFT',
            publishedAt: null,
          },
        });
        return { event: createdEvent, invitation: createdInvitation };
      }));
    } catch (error) {
      if (generationId) this.progress?.fail(userId, generationId, this.progressError(error));
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'This event already has an invitation or the slug is unavailable.'
        );
      }
      throw error;
    }

    try {
      updateProgress('GENERATING_WEBSITE');
      const design = generationId
        ? await this.designs.generateHtmlWithAi(
            userId,
            invitation.id,
            prompt,
            updateProgress,
            signal
          )
        : await this.designs.generateHtmlWithAi(userId, invitation.id, prompt, undefined, signal);
      const response = {
        event: this.toEvent(event),
        invitation: this.toInvitation(invitation),
        design,
        aiError: null,
      };
      if (generationId) this.progress?.complete(userId, generationId);
      return response;
    } catch (error) {
      // The caller cancelled its own request: no failure progress, no
      // fallback 201 payload, no provider-failure message. Just propagate.
      if (error instanceof AiGenerationCancelledError) throw error;
      if (error instanceof HttpException) {
        const safeError = this.progressError(error);
        if (generationId) this.progress?.fail(userId, generationId, safeError);
        return {
          event: this.toEvent(event),
          invitation: this.toInvitation(invitation),
          design: null,
          // Progress-enabled clients receive a safe, user-facing category,
          // never provider response details.
          aiError: generationId ? safeError : error.message,
        };
      }
      if (generationId) this.progress?.fail(userId, generationId, this.progressError(error));
      throw error;
    }
  }

  private progressError(error: unknown): string {
    if (error instanceof HttpException && /timed out/i.test(error.message)) {
      return 'The AI provider took too long to respond.';
    }
    return 'The website could not be generated. Please try again.';
  }

  /**
   * Smart Question Flow analysis. Decides whether the prompt plus everything
   * gathered so far is enough to generate a good invitation, and returns
   * either the merged brief (READY) or exactly one next question.
   *
   * Deliberately side-effect free: no event, invitation, or design is created,
   * and no generation progress is emitted. The flow is stateless — the client
   * holds the brief and the answers until it calls the existing generate
   * endpoint.
   */
  async analyze(dto: AnalyzeAiStudioDto, signal?: AbortSignal): Promise<AiStudioAnalyzeResponse> {
    let raw: unknown;
    try {
      raw = await this.requireProvider().analyzeDetails({
        prompt: dto.prompt,
        collectedData: dto.collectedData ?? {},
        answers: (dto.answers ?? []).map((answer) => ({
          questionId: answer.questionId,
          value: answer.value ?? null,
        })),
        lastQuestionId: dto.lastQuestionId,
        signal,
      });
    } catch (error) {
      // Cancellation stays neutral, and a configuration problem keeps its own
      // safe 503; everything else becomes a generic 502 with no provider detail.
      if (error instanceof AiGenerationCancelledError) throw error;
      if (error instanceof HttpException) throw error;
      this.logger.warn('Smart question analysis failed', errorName(error));
      throw new BadGatewayException(
        'The assistant could not analyse the request. Please try again.'
      );
    }
    const analysis = parseSmartAnalysis(raw);
    if (!analysis) {
      this.logger.warn('Smart question analysis returned an unusable shape');
      throw new BadGatewayException(
        'The assistant could not analyse the request. Please try again.'
      );
    }
    return analysis;
  }

  private requireProvider(): InvitationAiProvider {
    if (!this.aiProvider) {
      throw new ServiceUnavailableException('AI generation is not configured.');
    }
    return this.aiProvider;
  }

  async refineGeneratedWebsite(
    userId: string,
    invitationId: string,
    prompt: string
  ): Promise<AiStudioRefineResponse> {
    return this.designs.refineHtmlWithAi(userId, invitationId, prompt);
  }

  /**
   * Best-effort extraction: any provider failure (missing key, timeout,
   * invalid output) falls back to deterministic details so creation never
   * depends on AI availability.
   */
  private async resolveEventDetails(prompt: string): Promise<{
    title: string;
    eventType: string;
    eventDate: Date;
    venueName: string | null;
  }> {
    let raw: Record<string, unknown> = {};
    try {
      const extracted = await this.aiProvider.extractEventDetails(prompt);
      if (extracted && typeof extracted === 'object') raw = extracted;
    } catch {
      // Fall through to deterministic defaults below.
    }
    const clean = (value: unknown, max: number): string | null => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      return trimmed ? trimmed.slice(0, max) : null;
    };
    return {
      title: clean(raw.title, 255) ?? prompt.trim().slice(0, 80) ?? 'Untitled celebration',
      eventType: clean(raw.eventType, 100) ?? 'Celebration',
      eventDate: this.parseDateOrToday(raw.eventDate),
      venueName: clean(raw.venueName, 255),
    };
  }

  private parseDateOrToday(value: unknown): Date {
    if (typeof value === 'string' && EVENT_DATE_PATTERN.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      const parsed = new Date(Date.UTC(year ?? 0, (month ?? 0) - 1, day ?? 0));
      if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value) {
        return parsed;
      }
    }
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  private invitationSlug(title: string): string {
    const base = title
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '-')
      .slice(0, 64);
    return `${base || 'invitation'}-${randomUUID().slice(0, 8)}`;
  }

  private toEvent(event: {
    id: string;
    title: string;
    eventType: string;
    eventDate: Date;
    venueName: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): AiStudioEventResponse {
    return {
      id: event.id,
      title: event.title,
      eventType: event.eventType,
      eventDate: event.eventDate.toISOString().slice(0, 10),
      venueName: event.venueName,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }

  private toInvitation(invitation: {
    id: string;
    eventId: string;
    slug: string;
    status: string;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): AiStudioInvitationResponse {
    return {
      id: invitation.id,
      eventId: invitation.eventId,
      slug: invitation.slug,
      status: invitation.status,
      publishedAt: invitation.publishedAt?.toISOString() ?? null,
      createdAt: invitation.createdAt.toISOString(),
      updatedAt: invitation.updatedAt.toISOString(),
    };
  }
}
