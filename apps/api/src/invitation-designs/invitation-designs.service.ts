import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  INVITATION_AI_PROVIDER,
  AiGenerationCancelledError,
  InvitationAiProvider,
  InvitationAiProviderError,
  type GeneratedWebsiteProject,
} from './ai-provider.types';
import type { InvitationThemeId } from './dto/set-invitation-design.dto';
import type {
  GenerateInvitationDesignDto,
  RefineInvitationDesignDto,
} from './dto/ai-invitation-design.dto';
import type { UpdateInvitationDesignDto } from './dto/update-invitation-design.dto';
import {
  HtmlArtifactValidationError,
  isHtmlArtifactEnvelope,
  legacySpecificationToHtmlArtifact,
  sanitizeHtmlArtifact,
  toPublicHtmlArtifactMetadata,
  type HtmlArtifactEnvelope,
  type PublicHtmlArtifactMetadata,
} from './html-artifact';
import { INVITATION_SLUG_PATTERN } from '../invitations/dto/create-invitation.dto';

export type InvitationDesignSpecification = {
  schemaVersion: 1;
  theme: InvitationThemeId;
  content: {
    eyebrow: string;
    title: string;
    dateLine: string;
    venueLine: string;
  };
  colors: {
    background: string;
    surface: string;
    text: string;
    accent: string;
  };
  typography: {
    headingFamily: 'Playfair Display' | 'Inter';
    bodyFamily: 'Playfair Display' | 'Inter';
  };
  layout: {
    alignment: 'center' | 'left';
    density: 'airy' | 'compact';
  };
  sections: InvitationSection[];
  elements: InvitationElement[];
};

export type InvitationSection = {
  id: string;
  type: 'hero' | 'details' | 'story' | 'schedule' | 'rsvp' | 'note';
  title: string;
  body: string;
  order: number;
  visible: boolean;
  /**
   * Hero presentation variant. Absent or unknown = classic centered hero
   * (legacy look). Only `hero` sections keep it; validated at runtime
   * against heroSectionVariants because DTOs carry plain strings.
   */
  variant?: string;
};

/** Deterministic hero presentations rendered by clients. Geometry stays in code. */
export const heroSectionVariants = ['centered', 'split', 'overlay', 'minimal'] as const;

export type HeroSectionVariant = (typeof heroSectionVariants)[number];

export type InvitationElement = {
  id: string;
  type: 'text' | 'image' | 'section';
  label: string;
  text?: string;
  imageUrl?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  backgroundColor?: string;
};

type DesignStyle = Pick<
  InvitationDesignSpecification,
  'schemaVersion' | 'theme' | 'colors' | 'typography' | 'layout'
>;
type EventContext = {
  title: string;
  eventType: string;
  description: string | null;
  eventDate: Date;
  startTime: Date | null;
  endTime: Date | null;
  venueName: string | null;
  venueAddress: string | null;
};

const styles: Record<InvitationThemeId, DesignStyle> = {
  'classic-ivory': {
    schemaVersion: 1,
    theme: 'classic-ivory',
    colors: {
      background: '#FFFDF8',
      surface: '#FFFFFF',
      text: '#241C18',
      accent: '#8B7355',
    },
    typography: { headingFamily: 'Playfair Display', bodyFamily: 'Inter' },
    layout: { alignment: 'center', density: 'airy' },
  },
  'modern-contrast': {
    schemaVersion: 1,
    theme: 'modern-contrast',
    colors: {
      background: '#F7F4F1',
      surface: '#FFFFFF',
      text: '#171717',
      accent: '#7A263A',
    },
    typography: { headingFamily: 'Inter', bodyFamily: 'Inter' },
    layout: { alignment: 'left', density: 'airy' },
  },
  'romantic-blush': {
    schemaVersion: 1,
    theme: 'romantic-blush',
    colors: {
      background: '#FFF7F8',
      surface: '#FFFFFF',
      text: '#3A2026',
      accent: '#A45C6A',
    },
    typography: { headingFamily: 'Playfair Display', bodyFamily: 'Inter' },
    layout: { alignment: 'center', density: 'airy' },
  },
  'midnight-onyx': {
    schemaVersion: 1,
    theme: 'midnight-onyx',
    colors: {
      background: '#141210',
      surface: '#1E1B17',
      text: '#F2EDE4',
      accent: '#C9A227',
    },
    typography: { headingFamily: 'Playfair Display', bodyFamily: 'Inter' },
    layout: { alignment: 'center', density: 'airy' },
  },
  'sage-garden': {
    schemaVersion: 1,
    theme: 'sage-garden',
    colors: {
      background: '#EDF2E9',
      surface: '#FFFFFF',
      text: '#2E3A2C',
      accent: '#5F7A54',
    },
    typography: { headingFamily: 'Playfair Display', bodyFamily: 'Inter' },
    layout: { alignment: 'center', density: 'airy' },
  },
  'ocean-pearl': {
    schemaVersion: 1,
    theme: 'ocean-pearl',
    colors: {
      background: '#EAF1F6',
      surface: '#FFFFFF',
      text: '#22333F',
      accent: '#3E7CB1',
    },
    typography: { headingFamily: 'Inter', bodyFamily: 'Inter' },
    layout: { alignment: 'left', density: 'airy' },
  },
  'terracotta-fiesta': {
    schemaVersion: 1,
    theme: 'terracotta-fiesta',
    colors: {
      background: '#FBF1E6',
      surface: '#FFFFFF',
      text: '#4A2E1E',
      accent: '#C05621',
    },
    typography: { headingFamily: 'Playfair Display', bodyFamily: 'Inter' },
    layout: { alignment: 'center', density: 'airy' },
  },
  'lavender-mist': {
    schemaVersion: 1,
    theme: 'lavender-mist',
    colors: {
      background: '#F1EDF7',
      surface: '#FFFFFF',
      text: '#37314A',
      accent: '#7C6AAE',
    },
    typography: { headingFamily: 'Playfair Display', bodyFamily: 'Inter' },
    layout: { alignment: 'center', density: 'airy' },
  },
  'emerald-evening': {
    schemaVersion: 1,
    theme: 'emerald-evening',
    colors: {
      background: '#10201A',
      surface: '#16291F',
      text: '#EDF5EE',
      accent: '#3FA37A',
    },
    typography: { headingFamily: 'Playfair Display', bodyFamily: 'Inter' },
    layout: { alignment: 'center', density: 'airy' },
  },
};

const designSelect = {
  id: true,
  invitationId: true,
  version: true,
  designSpecification: true,
  sourceType: true,
  isActive: true,
  createdAt: true,
} satisfies Prisma.InvitationDesignSelect;

const eventSelect = {
  title: true,
  eventType: true,
  description: true,
  eventDate: true,
  startTime: true,
  endTime: true,
  venueName: true,
  venueAddress: true,
} satisfies Prisma.EventSelect;

type DesignResult = Prisma.InvitationDesignGetPayload<{ select: typeof designSelect }>;

export type InvitationDesignResponse = {
  id: string;
  invitationId: string;
  version: number;
  designSpecification: InvitationDesignSpecification;
  sourceType: string;
  isActive: boolean;
  createdAt: string;
};

export type InvitationHtmlDesignResponse = {
  id: string;
  invitationId: string;
  version: number;
  artifact: HtmlArtifactEnvelope;
  project: GeneratedWebsiteProject;
  sourceType: string;
  isActive: boolean;
  createdAt: string;
};

export type CurrentInvitationDesignResponse = {
  design: InvitationDesignResponse | InvitationHtmlDesignResponse | null;
};

export type PublicInvitationResponse =
  | { designSpecification: InvitationDesignSpecification }
  | { artifact: PublicHtmlArtifactMetadata; renderPath: string };

@Injectable()
export class InvitationDesignsService {
  private readonly logger = new Logger(InvitationDesignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(INVITATION_AI_PROVIDER)
    private readonly aiProvider?: InvitationAiProvider
  ) {}

  async findCurrent(
    userId: string,
    invitationId: string
  ): Promise<CurrentInvitationDesignResponse> {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, event: { userId } },
      select: {
        event: { select: eventSelect },
        designs: {
          where: { isActive: true },
          orderBy: { version: 'desc' },
          take: 1,
          select: designSelect,
        },
      },
    });
    if (!invitation) throw new NotFoundException('Invitation not found.');
    const design = invitation.designs[0];
    return { design: design ? this.toStoredResponse(design, invitation.event) : null };
  }

  async findPublished(slug: string, mediaBaseUrl?: string): Promise<PublicInvitationResponse> {
    this.validatePublicSlug(slug);
    const invitation = await this.prisma.invitation.findFirst({
      where: { slug, status: 'PUBLISHED', publishedAt: { not: null } },
      select: {
        event: { select: eventSelect },
        designs: {
          where: { isActive: true },
          orderBy: { version: 'desc' },
          take: 1,
          select: { designSpecification: true },
        },
      },
    });
    const design = invitation?.designs[0];
    if (!invitation || !design) {
      throw new NotFoundException('Invitation not found.');
    }
    if (isHtmlArtifactEnvelope(design.designSpecification)) {
      try {
        const artifact = sanitizeHtmlArtifact(design.designSpecification);
        return {
          artifact: toPublicHtmlArtifactMetadata(artifact),
          renderPath: `/api/v1/public/invitations/${slug}/render`,
        };
      } catch (error) {
        if (error instanceof HtmlArtifactValidationError) {
          throw new NotFoundException('Invitation not found.');
        }
        throw error;
      }
    }
    const specification = this.normalizeSpecification(design.designSpecification, invitation.event);
    return {
      designSpecification:
        mediaBaseUrl != null
          ? this.resolveMediaReferences(specification, slug, mediaBaseUrl)
          : specification,
    };
  }

  async findPublishedRenderable(slug: string): Promise<HtmlArtifactEnvelope> {
    this.validatePublicSlug(slug);
    const invitation = await this.prisma.invitation.findFirst({
      where: { slug, status: 'PUBLISHED', publishedAt: { not: null } },
      select: {
        event: { select: eventSelect },
        designs: {
          where: { isActive: true },
          orderBy: { version: 'desc' },
          take: 1,
          select: { designSpecification: true },
        },
      },
    });
    const design = invitation?.designs[0];
    if (!invitation || !design) throw new NotFoundException('Invitation not found.');
    if (isHtmlArtifactEnvelope(design.designSpecification)) {
      try {
        return sanitizeHtmlArtifact(design.designSpecification);
      } catch (error) {
        if (error instanceof HtmlArtifactValidationError) {
          throw new NotFoundException('Invitation not found.');
        }
        throw error;
      }
    }
    return legacySpecificationToHtmlArtifact(
      this.normalizeSpecification(design.designSpecification, invitation.event)
    );
  }

  async findOwnedRenderable(userId: string, invitationId: string): Promise<HtmlArtifactEnvelope> {
    const invitation = await this.findOwnedWithLatest(userId, invitationId);
    const design = invitation.designs[0];
    if (!design?.isActive) throw new NotFoundException('Invitation design not found.');
    if (isHtmlArtifactEnvelope(design.designSpecification)) {
      return sanitizeHtmlArtifact(design.designSpecification);
    }
    return legacySpecificationToHtmlArtifact(
      this.normalizeSpecification(design.designSpecification, invitation.event)
    );
  }

  /**
   * Rewrites `media://{id}` element references into absolute public content
   * URLs so guests (unauthenticated) can load uploaded photos. Plain https
   * URLs pass through untouched.
   */
  resolveMediaReferences(
    specification: InvitationDesignSpecification,
    slug: string,
    mediaBaseUrl: string
  ): InvitationDesignSpecification {
    const base = mediaBaseUrl.replace(/\/$/, '');
    const elements = specification.elements?.map((element) => {
      if (element.type !== 'image' || typeof element.imageUrl !== 'string') return element;
      const match = /^media:\/\/([0-9a-fA-F-]{36})$/.exec(element.imageUrl);
      if (!match) return element;
      return {
        ...element,
        imageUrl: `${base}/api/v1/public/invitations/${slug}/media/${match[1]}/content`,
      };
    });
    return { ...specification, elements };
  }

  async create(
    userId: string,
    invitationId: string,
    theme: InvitationThemeId
  ): Promise<InvitationDesignResponse> {
    const invitation = await this.findOwnedWithLatest(userId, invitationId);
    const latest = invitation.designs[0];
    if (latest?.isActive) {
      throw new ConflictException('This invitation already has an active design.');
    }
    const specification = this.presetSpecification(theme, invitation.event);

    try {
      const design = await this.prisma.invitationDesign.create({
        data: {
          invitationId,
          version: (latest?.version ?? 0) + 1,
          designSpecification: specification as Prisma.InputJsonValue,
          sourceType: 'MANUAL',
          isActive: true,
        },
        select: designSelect,
      });
      return this.toResponse(design, invitation.event);
    } catch (error) {
      this.rethrowWriteConflict(error);
    }
  }

  async update(
    userId: string,
    invitationId: string,
    dto: UpdateInvitationDesignDto
  ): Promise<InvitationDesignResponse> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one design field is required.');
    }

    const invitation = await this.findOwnedWithLatest(userId, invitationId);
    const latest = invitation.designs[0];
    if (!latest?.isActive) throw new NotFoundException('Invitation design not found.');
    if (isHtmlArtifactEnvelope(latest.designSpecification)) {
      throw new ConflictException(
        'Standalone HTML designs cannot be edited as structured designs.'
      );
    }

    const current = this.normalizeSpecification(latest.designSpecification, invitation.event);
    const base = dto.theme
      ? this.presetSpecification(dto.theme, invitation.event, current.content)
      : current;
    const next: InvitationDesignSpecification = {
      ...base,
      content: dto.content ?? base.content,
      colors: dto.colors ?? base.colors,
      typography: dto.typography ?? base.typography,
      layout: dto.layout ?? base.layout,
      sections: dto.sections ?? base.sections,
      elements: dto.elements ?? base.elements,
    };
    if (JSON.stringify(current) === JSON.stringify(next)) {
      throw new BadRequestException('Design changes are required.');
    }

    try {
      const [, design] = await this.prisma.$transaction([
        this.prisma.invitationDesign.updateMany({
          where: { invitationId, isActive: true },
          data: { isActive: false },
        }),
        this.prisma.invitationDesign.create({
          data: {
            invitationId,
            version: latest.version + 1,
            designSpecification: next as Prisma.InputJsonValue,
            sourceType: 'MANUAL',
            isActive: true,
          },
          select: designSelect,
        }),
      ]);
      return this.toResponse(design, invitation.event);
    } catch (error) {
      this.rethrowWriteConflict(error);
    }
  }

  async generateWithAi(
    userId: string,
    invitationId: string,
    dto: GenerateInvitationDesignDto
  ): Promise<InvitationDesignResponse> {
    const invitation = await this.findOwnedWithLatest(userId, invitationId);
    const latest = invitation.designs[0];
    const current =
      latest && !isHtmlArtifactEnvelope(latest.designSpecification)
        ? this.normalizeSpecification(latest.designSpecification, invitation.event)
        : null;
    const operationType = dto.mode === 'regenerate' ? 'REGENERATE_DESIGN' : 'GENERATE_DESIGN';
    try {
      const result = await this.requireAiProvider().generateDesign({
        operation: dto.mode ?? 'generate',
        prompt: dto.prompt,
        event: this.toAiEventContext(invitation.event),
        currentDesign: current,
      });
      const next = this.normalizeSpecification(
        result.specification as Prisma.JsonValue,
        invitation.event
      );
      return this.persistVersion(
        userId,
        invitationId,
        invitation.event,
        latest?.version ?? 0,
        next,
        {
          sourceType: 'AI_GENERATED',
          operationType,
          tokensUsed: result.tokensUsed,
        }
      );
    } catch (error) {
      await this.logAiFailure(userId, invitationId, operationType);
      this.rethrowAiError(error);
    }
  }

  async generateHtmlWithAi(
    userId: string,
    invitationId: string,
    prompt: string,
    onProgress?: (stage: 'PARSING_RESPONSE' | 'VALIDATING_WEBSITE' | 'SAVING_WEBSITE') => void,
    signal?: AbortSignal
  ): Promise<InvitationHtmlDesignResponse> {
    const cleanPrompt = prompt.trim();
    if (cleanPrompt.length < 10 || cleanPrompt.length > 2_000) {
      throw new BadRequestException('Prompt must be between 10 and 2000 characters.');
    }
    const invitation = await this.findOwnedEventWithLatestVersion(userId, invitationId);
    try {
      const result = await this.requireAiProvider().generateHtml({
        prompt: cleanPrompt,
        event: this.toAiEventContext(invitation.event),
        onProgress,
        signal,
      });
      // A cancellation that lands after the provider responds must still win:
      // never persist a design the caller no longer wants.
      if (signal?.aborted) throw new AiGenerationCancelledError();
      onProgress?.('VALIDATING_WEBSITE');
      const artifact = sanitizeHtmlArtifact({
        ...result.artifact,
        format: 'html',
        version: 1,
      });
      onProgress?.('SAVING_WEBSITE');
      return this.persistHtmlVersion(
        userId,
        invitationId,
        invitation.designs[0]?.version ?? 0,
        artifact,
        {
          sourceType: 'AI_GENERATED',
          operationType: 'GENERATE_DESIGN',
          tokensUsed: result.tokensUsed,
        }
      );
    } catch (caught) {
      if (caught instanceof HtmlArtifactValidationError) {
        this.logger.debug({
          event: 'html-artifact-validation-failure',
          artifactField: caught.field,
          category: caught.category,
          rule: caught.rule,
          contentLength: caught.contentLength,
          source: caught.source,
        });
      }
      // Caller cancellation is not a provider failure: no FAILED telemetry,
      // no failure mapping, no persistence.
      if (caught instanceof AiGenerationCancelledError || signal?.aborted) {
        throw new AiGenerationCancelledError();
      }
      const error =
        caught instanceof HtmlArtifactValidationError
          ? new InvitationAiProviderError(
              'AI returned an invalid HTML design.',
              'invalid-output',
              caught
            )
          : caught;
      await this.logAiFailure(userId, invitationId, 'GENERATE_DESIGN');
      this.rethrowAiError(error);
    }
  }

  async refineHtmlWithAi(
    userId: string,
    invitationId: string,
    instruction: string
  ): Promise<InvitationHtmlDesignResponse> {
    const cleanInstruction = instruction.trim();
    if (cleanInstruction.length < 3 || cleanInstruction.length > 1_000) {
      throw new BadRequestException(
        'Refinement instruction must be between 3 and 1000 characters.'
      );
    }
    const invitation = await this.findOwnedEventWithLatestVersion(userId, invitationId);
    const latest = invitation.designs[0];
    if (!latest?.isActive || !isHtmlArtifactEnvelope(latest.designSpecification)) {
      throw new ConflictException('A generated website is required before it can be refined.');
    }
    try {
      const currentArtifact = sanitizeHtmlArtifact(latest.designSpecification);
      const result = await this.requireAiProvider().refineHtml({
        prompt: cleanInstruction,
        event: this.toAiEventContext(invitation.event),
        project: this.toWebsiteProject(currentArtifact),
      });
      const artifact = sanitizeHtmlArtifact({
        ...result.artifact,
        format: 'html',
        version: 1,
      });
      if (JSON.stringify(currentArtifact) === JSON.stringify(artifact)) {
        throw new BadRequestException('Refinement changes are required.');
      }
      return this.persistHtmlVersion(userId, invitationId, latest.version, artifact, {
        sourceType: 'AI_EDIT',
        operationType: 'EDIT_DESIGN',
        tokensUsed: result.tokensUsed,
      });
    } catch (caught) {
      const error =
        caught instanceof HtmlArtifactValidationError
          ? new InvitationAiProviderError(
              'AI returned an invalid website project.',
              'invalid-output'
            )
          : caught;
      await this.logAiFailure(userId, invitationId, 'EDIT_DESIGN');
      this.rethrowAiError(error);
    }
  }

  async refineWithAi(
    userId: string,
    invitationId: string,
    dto: RefineInvitationDesignDto
  ): Promise<InvitationDesignResponse> {
    const invitation = await this.findOwnedWithLatest(userId, invitationId);
    const latest = invitation.designs[0];
    if (!latest?.isActive) throw new NotFoundException('Invitation design not found.');
    if (isHtmlArtifactEnvelope(latest.designSpecification)) {
      throw new ConflictException(
        'Standalone HTML designs cannot be refined as structured designs.'
      );
    }
    const current = this.normalizeSpecification(latest.designSpecification, invitation.event);
    try {
      const result = await this.requireAiProvider().generateDesign({
        operation: 'refine',
        prompt: dto.instruction,
        event: this.toAiEventContext(invitation.event),
        currentDesign: current,
      });
      const next = this.normalizeSpecification(
        result.specification as Prisma.JsonValue,
        invitation.event
      );
      if (JSON.stringify(current) === JSON.stringify(next)) {
        throw new BadRequestException('Refinement changes are required.');
      }
      return this.persistVersion(userId, invitationId, invitation.event, latest.version, next, {
        sourceType: 'AI_EDIT',
        operationType: 'EDIT_DESIGN',
        tokensUsed: result.tokensUsed,
      });
    } catch (error) {
      await this.logAiFailure(userId, invitationId, 'EDIT_DESIGN');
      this.rethrowAiError(error);
    }
  }

  private async findOwnedWithLatest(userId: string, invitationId: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, event: { userId } },
      select: {
        id: true,
        event: { select: eventSelect },
        designs: {
          orderBy: { version: 'desc' },
          take: 1,
          select: designSelect,
        },
      },
    });
    if (!invitation) throw new NotFoundException('Invitation not found.');
    return invitation;
  }

  private async findOwnedEventWithLatestVersion(userId: string, invitationId: string) {
    const invitation = await this.prisma.invitation.findFirst({
      where: { id: invitationId, event: { userId } },
      select: {
        id: true,
        event: { select: eventSelect },
        designs: {
          orderBy: { version: 'desc' },
          take: 1,
          select: designSelect,
        },
      },
    });
    if (!invitation) throw new NotFoundException('Invitation not found.');
    return invitation;
  }

  private presetSpecification(
    theme: InvitationThemeId,
    event: EventContext,
    content = this.defaultContent(event)
  ): InvitationDesignSpecification {
    const base = { ...styles[theme], content };
    return {
      ...base,
      sections: this.defaultSections(event, content),
      elements: this.defaultElements(base),
    };
  }

  private defaultContent(event: EventContext): InvitationDesignSpecification['content'] {
    return {
      eyebrow: 'You are invited',
      title: event.title,
      dateLine: new Intl.DateTimeFormat('en', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(event.eventDate),
      venueLine: event.venueName ?? event.venueAddress ?? 'Venue details to follow',
    };
  }

  private normalizeSpecification(
    value: Prisma.JsonValue,
    event: EventContext
  ): InvitationDesignSpecification {
    const stored = value as Partial<InvitationDesignSpecification>;
    const theme =
      typeof stored.theme === 'string' && Object.hasOwn(styles, stored.theme)
        ? stored.theme
        : 'classic-ivory';
    const preset = this.presetSpecification(theme, event);
    const content = stored.content;
    const colors = stored.colors;
    const typography = stored.typography;
    const layout = stored.layout;
    const sections = Array.isArray(stored.sections) ? stored.sections : null;
    const elements = Array.isArray(stored.elements) ? stored.elements : null;
    const color = (candidate: unknown, fallback: string) =>
      typeof candidate === 'string' && /^#[0-9A-F]{6}$/.test(candidate) ? candidate : fallback;
    const font = (candidate: unknown, fallback: 'Playfair Display' | 'Inter') =>
      candidate === 'Playfair Display' || candidate === 'Inter' ? candidate : fallback;
    const normalizedContent = {
      eyebrow: typeof content?.eyebrow === 'string' ? content.eyebrow : preset.content.eyebrow,
      title: typeof content?.title === 'string' ? content.title : preset.content.title,
      dateLine: typeof content?.dateLine === 'string' ? content.dateLine : preset.content.dateLine,
      venueLine:
        typeof content?.venueLine === 'string' ? content.venueLine : preset.content.venueLine,
    };
    const normalizedColors = {
      background: color(colors?.background, preset.colors.background),
      surface: color(colors?.surface, preset.colors.surface),
      text: color(colors?.text, preset.colors.text),
      accent: color(colors?.accent, preset.colors.accent),
    };
    const normalizedTypography = {
      headingFamily: font(typography?.headingFamily, preset.typography.headingFamily),
      bodyFamily: font(typography?.bodyFamily, preset.typography.bodyFamily),
    };
    const normalizedLayout = {
      alignment:
        layout?.alignment === 'left' || layout?.alignment === 'center'
          ? layout.alignment
          : preset.layout.alignment,
      density:
        layout?.density === 'compact' || layout?.density === 'airy'
          ? layout.density
          : preset.layout.density,
    };
    const normalizedBase = {
      schemaVersion: 1 as const,
      theme,
      content: normalizedContent,
      colors: normalizedColors,
      typography: normalizedTypography,
      layout: normalizedLayout,
    };
    return {
      schemaVersion: 1,
      theme,
      content: normalizedContent,
      colors: normalizedColors,
      typography: normalizedTypography,
      layout: normalizedLayout,
      sections: this.normalizeSections(sections, event, normalizedContent),
      elements: this.normalizeElements(elements, {
        ...normalizedBase,
        sections: [],
        elements: [],
      }),
    };
  }

  private async persistVersion(
    userId: string,
    invitationId: string,
    event: EventContext,
    previousVersion: number,
    specification: InvitationDesignSpecification,
    metadata: { sourceType: string; operationType: string; tokensUsed?: number | null }
  ): Promise<InvitationDesignResponse> {
    try {
      const [, design] = await this.prisma.$transaction([
        this.prisma.invitationDesign.updateMany({
          where: { invitationId, isActive: true },
          data: { isActive: false },
        }),
        this.prisma.invitationDesign.create({
          data: {
            invitationId,
            version: previousVersion + 1,
            designSpecification: specification as Prisma.InputJsonValue,
            sourceType: metadata.sourceType,
            isActive: true,
          },
          select: designSelect,
        }),
        this.prisma.aiUsage.create({
          data: {
            userId,
            invitationId,
            operationType: metadata.operationType,
            status: 'SUCCEEDED',
            tokensUsed: metadata.tokensUsed ?? this.estimateTokens(specification),
          },
          select: { id: true },
        }),
      ]);
      return this.toResponse(design, event);
    } catch (error) {
      this.rethrowWriteConflict(error);
    }
  }

  private async persistHtmlVersion(
    userId: string,
    invitationId: string,
    previousVersion: number,
    artifact: HtmlArtifactEnvelope,
    metadata: { sourceType: string; operationType: string; tokensUsed?: number | null }
  ): Promise<InvitationHtmlDesignResponse> {
    try {
      const [, design] = await this.prisma.$transaction([
        this.prisma.invitationDesign.updateMany({
          where: { invitationId, isActive: true },
          data: { isActive: false },
        }),
        this.prisma.invitationDesign.create({
          data: {
            invitationId,
            version: previousVersion + 1,
            designSpecification: artifact as Prisma.InputJsonValue,
            sourceType: metadata.sourceType,
            isActive: true,
          },
          select: designSelect,
        }),
        this.prisma.aiUsage.create({
          data: {
            userId,
            invitationId,
            operationType: metadata.operationType,
            status: 'SUCCEEDED',
            tokensUsed: metadata.tokensUsed ?? this.estimateTokens(artifact),
          },
          select: { id: true },
        }),
      ]);
      return this.toHtmlResponse(design);
    } catch (error) {
      this.rethrowWriteConflict(error);
    }
  }

  private toWebsiteProject(artifact: HtmlArtifactEnvelope): GeneratedWebsiteProject {
    return {
      name: artifact.title,
      description: artifact.description,
      files: [
        { path: 'index.html', content: artifact.body },
        { path: 'styles.css', content: artifact.css },
      ],
    };
  }

  private defaultSections(
    event: EventContext,
    content: InvitationDesignSpecification['content']
  ): InvitationSection[] {
    return [
      {
        id: 'hero',
        type: 'hero',
        title: content.title,
        body: content.eyebrow,
        order: 0,
        visible: true,
      },
      {
        id: 'details',
        type: 'details',
        title: 'Details',
        body: `${content.dateLine} at ${content.venueLine}`,
        order: 1,
        visible: true,
      },
      {
        id: 'story',
        type: 'story',
        title: 'A note for guests',
        body:
          event.venueAddress ??
          'Join us for a memorable celebration with the people who matter most.',
        order: 2,
        visible: true,
      },
      {
        id: 'rsvp',
        type: 'rsvp',
        title: 'RSVP',
        body: 'Confirm attendance and share any notes for the host.',
        order: 3,
        visible: true,
      },
    ];
  }

  private defaultElements(
    specification: Pick<InvitationDesignSpecification, 'content' | 'colors' | 'layout'>
  ): InvitationElement[] {
    const { content, colors, layout } = specification;
    return [
      {
        id: 'eyebrow',
        type: 'text',
        label: 'Eyebrow',
        text: content.eyebrow,
        x: layout.alignment === 'center' ? 20 : 10,
        y: 12,
        width: 60,
        height: 8,
        fontSize: 13,
        color: colors.accent,
      },
      {
        id: 'title',
        type: 'text',
        label: 'Title',
        text: content.title,
        x: layout.alignment === 'center' ? 12 : 10,
        y: 25,
        width: 76,
        height: 20,
        fontSize: 48,
        color: colors.text,
      },
      {
        id: 'details',
        type: 'section',
        label: 'Details',
        text: `${content.dateLine}\n${content.venueLine}`,
        x: layout.alignment === 'center' ? 22 : 10,
        y: 58,
        width: 56,
        height: 18,
        fontSize: 16,
        color: colors.text,
      },
      {
        id: 'image',
        type: 'image',
        label: 'Image',
        x: 66,
        y: 10,
        width: 24,
        height: 28,
        fontSize: 14,
        color: colors.text,
        backgroundColor: colors.background,
      },
    ];
  }

  private normalizeSections(
    sections: unknown[] | null,
    event: EventContext,
    content: InvitationDesignSpecification['content']
  ): InvitationSection[] {
    const fallback = this.defaultSections(event, content);
    if (!sections?.length) return fallback;
    const normalized = sections
      .map((section, index) => {
        const candidate = section as Partial<InvitationSection>;
        if (!candidate.id || !candidate.type || !candidate.title || !candidate.body) return null;
        if (!['hero', 'details', 'story', 'schedule', 'rsvp', 'note'].includes(candidate.type))
          return null;
        return {
          id: String(candidate.id).slice(0, 64),
          type: candidate.type,
          title: String(candidate.title).slice(0, 120),
          body: String(candidate.body).slice(0, 500),
          order:
            typeof candidate.order === 'number' && Number.isFinite(candidate.order)
              ? Math.max(0, Math.min(20, Math.round(candidate.order)))
              : index,
          visible: candidate.visible !== false,
          ...(candidate.type === 'hero' &&
          typeof candidate.variant === 'string' &&
          (heroSectionVariants as readonly string[]).includes(candidate.variant)
            ? { variant: candidate.variant }
            : {}),
        };
      })
      .filter((section): section is InvitationSection => Boolean(section))
      .sort((a, b) => a.order - b.order);
    return normalized.length ? normalized : fallback;
  }

  private normalizeImageUrl(candidate: unknown): string | undefined {
    if (typeof candidate !== 'string') return undefined;
    // Uploaded library photo referenced by id — resolved to a servable URL
    // per context (public absolute URL for guests, signed preview for owners).
    if (/^media:\/\/[0-9a-fA-F-]{36}$/.test(candidate)) return candidate;
    if (/^https?:\/\//.test(candidate)) return candidate.slice(0, 1000);
    return undefined;
  }

  private normalizeElements(
    elements: unknown[] | null,
    fallbackSpec: InvitationDesignSpecification
  ): InvitationElement[] {
    const fallback = this.defaultElements(fallbackSpec);
    if (!elements?.length) return fallback;
    const color = (candidate: unknown, fallbackColor: string) =>
      typeof candidate === 'string' && /^#[0-9A-F]{6}$/.test(candidate) ? candidate : fallbackColor;
    const bounded = (candidate: unknown, fallbackValue: number, min: number, max: number) =>
      typeof candidate === 'number' && Number.isFinite(candidate)
        ? Math.max(min, Math.min(max, Math.round(candidate)))
        : fallbackValue;
    const normalized: InvitationElement[] = elements
      .map((element) => {
        const candidate = element as Partial<InvitationElement>;
        if (!candidate.id || !candidate.type || !candidate.label) return null;
        if (!['text', 'image', 'section'].includes(candidate.type)) return null;
        return {
          id: String(candidate.id).slice(0, 64),
          type: candidate.type,
          label: String(candidate.label).slice(0, 80),
          text: typeof candidate.text === 'string' ? candidate.text.slice(0, 300) : undefined,
          imageUrl: this.normalizeImageUrl(candidate.imageUrl),
          x: bounded(candidate.x, 10, 0, 100),
          y: bounded(candidate.y, 10, 0, 100),
          width: bounded(candidate.width, 40, 8, 100),
          height: bounded(candidate.height, 12, 4, 100),
          fontSize: bounded(candidate.fontSize, 16, 10, 96),
          color: color(candidate.color, fallbackSpec.colors.text),
          backgroundColor: candidate.backgroundColor
            ? color(candidate.backgroundColor, fallbackSpec.colors.background)
            : undefined,
        };
      })
      .filter((element): element is NonNullable<typeof element> => Boolean(element));
    return normalized.length ? normalized : fallback;
  }

  private requireAiProvider(): InvitationAiProvider {
    if (!this.aiProvider) {
      throw new InvitationAiProviderError('AI provider is unavailable.', 'configuration');
    }
    return this.aiProvider;
  }

  private toAiEventContext(event: EventContext) {
    return {
      title: event.title.slice(0, 255),
      eventType: (event.eventType ?? 'Event').slice(0, 100),
      description: event.description?.slice(0, 2_000) ?? null,
      eventDate: event.eventDate.toISOString().slice(0, 10),
      startTime: event.startTime?.toISOString().slice(11, 16) ?? null,
      endTime: event.endTime?.toISOString().slice(11, 16) ?? null,
      venueName: event.venueName?.slice(0, 255) ?? null,
      venueAddress: event.venueAddress?.slice(0, 500) ?? null,
    };
  }

  private validatePublicSlug(slug: string): void {
    if (slug.length > 255 || !INVITATION_SLUG_PATTERN.test(slug)) {
      throw new NotFoundException('Invitation not found.');
    }
  }

  private async logAiFailure(
    userId: string,
    invitationId: string,
    operationType: string
  ): Promise<void> {
    try {
      await this.prisma.aiUsage.create({
        data: {
          userId,
          invitationId,
          operationType,
          status: 'FAILED',
          tokensUsed: null,
        },
        select: { id: true },
      });
    } catch {
      // Failure telemetry must never mask the original provider error.
    }
  }

  private rethrowAiError(error: unknown): never {
    if (error instanceof BadRequestException) throw error;
    if (error instanceof InvitationAiProviderError) {
      if (error.status === 'configuration') {
        throw new ServiceUnavailableException('AI generation is not configured.');
      }
      if (error.status === 'timeout') {
        throw new BadGatewayException('AI generation timed out. Please try again.');
      }
      if (error.status === 'invalid-output') {
        throw new BadGatewayException('AI returned an invalid design. Please try again.');
      }
      throw new BadGatewayException('AI generation failed. Please try again.');
    }
    throw error;
  }

  private estimateTokens(value: unknown): number {
    return Math.ceil(JSON.stringify(value).length / 4);
  }

  private rethrowWriteConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      throw new ConflictException('The invitation design changed. Refresh and try again.');
    }
    throw error;
  }

  private toStoredResponse(
    design: DesignResult,
    event: EventContext
  ): InvitationDesignResponse | InvitationHtmlDesignResponse {
    return isHtmlArtifactEnvelope(design.designSpecification)
      ? this.toHtmlResponse(design)
      : this.toResponse(design, event);
  }

  private toHtmlResponse(design: DesignResult): InvitationHtmlDesignResponse {
    const artifact = sanitizeHtmlArtifact(design.designSpecification);
    return {
      id: design.id,
      invitationId: design.invitationId,
      version: design.version,
      artifact,
      project: this.toWebsiteProject(artifact),
      sourceType: design.sourceType,
      isActive: design.isActive,
      createdAt: design.createdAt.toISOString(),
    };
  }

  private toResponse(design: DesignResult, event: EventContext): InvitationDesignResponse {
    return {
      id: design.id,
      invitationId: design.invitationId,
      version: design.version,
      designSpecification: this.normalizeSpecification(design.designSpecification, event),
      sourceType: design.sourceType,
      isActive: design.isActive,
      createdAt: design.createdAt.toISOString(),
    };
  }
}
