import { authenticatedApiClient } from './api-client';
import type {
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

/**
 * One-shot prompt → event + invitation + design.
 * Always persists (201); a null design with aiError means generation failed
 * and can be retried per-invitation without losing anything.
 */
export const generateAiStudio = (prompt: string) =>
  authenticatedApiClient<AiStudioResult>('/ai-studio/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });

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
