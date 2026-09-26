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
  try {
    const base = getApiUrl().replace(/\/$/, '');
    const response = await fetch(`${base}/public/invitations/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (response.status === 404 || !response.ok) return null;
    return (await response.json()) as PublicInvitation;
  } catch {
    return null;
  }
});
