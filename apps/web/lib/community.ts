import { authenticatedApiClient } from './api-client';
import { getApiUrl } from './env';
import type { InvitationDesignSpecification } from './invitation-designs';

export type CommunityDesignRecord = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  specification: InvitationDesignSpecification;
  creator: { name: string };
  engagement: { views: number; likes: number; saves: number };
  isPublished: boolean;
  createdAt: string;
};

export async function getCommunityDesigns(): Promise<CommunityDesignRecord[]> {
  const response = await fetch(`${getApiUrl().replace(/\/$/, '')}/community`, { next: { revalidate: 60 } });
  if (!response.ok) throw new Error('Community designs are unavailable.');
  return (await response.json()) as CommunityDesignRecord[];
}

export const applyCommunityDesign = (slug: string, invitationId: string) =>
  authenticatedApiClient<{ id: string; version: number; designSpecification: InvitationDesignSpecification }>(
    `/community/${encodeURIComponent(slug)}/use/${invitationId}`,
    { method: 'POST' }
  );

export const listMyCommunityDesigns = () =>
  authenticatedApiClient<CommunityDesignRecord[]>('/community/mine');

export const publishCommunityDesign = (
  invitationId: string,
  input: { title: string; description: string; category: string; slug?: string }
) =>
  authenticatedApiClient<CommunityDesignRecord>(`/community/invitations/${invitationId}`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateCommunityPublication = (id: string, published: boolean) =>
  authenticatedApiClient<{ published: boolean }>(`/community/${id}/publication`, {
    method: 'PATCH',
    body: JSON.stringify({ published }),
  });
