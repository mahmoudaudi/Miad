import { cache } from 'react';
import { getApiUrl } from './env';
import type { HtmlDesignArtifact, InvitationDesignSpecification } from './invitation-designs';

export type PublicInvitation =
  | { designSpecification: InvitationDesignSpecification }
  | {
      artifact: Pick<HtmlDesignArtifact, 'format' | 'version' | 'title' | 'description'>;
      renderPath: string;
    };

export const getPublicInvitation = cache(async (slug: string): Promise<PublicInvitation | null> => {
  const base = getApiUrl().replace(/\/$/, '');
  const response = await fetch(`${base}/public/invitations/${encodeURIComponent(slug)}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Public invitation request failed (${response.status}).`);
  return (await response.json()) as PublicInvitation;
});
