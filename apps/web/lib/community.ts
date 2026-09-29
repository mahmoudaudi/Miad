import { authenticatedApiClient } from './api-client';
import { getApiUrl } from './env';
import type { InvitationDesignSpecification } from './invitation-designs';

export type CommunityDesignRecord = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  // Community snapshots can predate the current schema; consumers must guard
  // their fields instead of trusting stored JSON to match the latest type.
  specification: unknown;
  creator: { name: string };
  engagement: { views: number; likes: number; saves: number };
  isPublished: boolean;
  createdAt: string;
};

export async function getCommunityDesigns(): Promise<CommunityDesignRecord[]> {
  try {
    const response = await fetch(`${getApiUrl().replace(/\/$/, '')}/community`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) return [];
    return (await response.json()) as CommunityDesignRecord[];
  } catch {
    return [];
  }
}

export const applyCommunityDesign = (slug: string, invitationId: string) =>
  authenticatedApiClient<{ id: string; version: number; designSpecification: InvitationDesignSpecification }>(
    `/community/${encodeURIComponent(slug)}/use/${invitationId}`,
    { method: 'POST' }
  );

export const cloneCommunityDesign = (slug: string) =>
  authenticatedApiClient<{ invitationId: string; designId: string; version: number }>(
    `/community/${encodeURIComponent(slug)}/clone`,
    { method: 'POST' }
  );

export const publishCommunityDesign = (
  invitationId: string,
  input: { title: string; description: string; category: string; slug?: string }
) =>
  authenticatedApiClient<CommunityDesignRecord>(`/community/invitations/${invitationId}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const getMyCommunityDesignForInvitation = (invitationId: string) =>
  authenticatedApiClient<CommunityDesignRecord | null>(
    `/community/invitations/${encodeURIComponent(invitationId)}`
  );

export const deleteMyCommunityDesign = (id: string) =>
  authenticatedApiClient<{ id: string; deleted: true }>(`/community/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
