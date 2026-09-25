import { getApiUrl } from './env';
import type { InvitationDesignSpecification } from './invitation-designs';

export type TemplateRecord = {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  specification: InvitationDesignSpecification;
  createdAt: string;
};

function isTemplateRecord(value: unknown): value is TemplateRecord {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.slug === 'string' &&
    typeof row.name === 'string' &&
    typeof row.description === 'string' &&
    typeof row.category === 'string' &&
    !!row.specification &&
    typeof row.specification === 'object' &&
    typeof row.createdAt === 'string'
  );
}

/**
 * Public template catalog, cached hourly (catalog data rarely changes).
 * The landing showcase is database-backed; if the API is unavailable we render
 * the honest empty state instead of substituting mock templates.
 */
let fallbackWarned = false;

export async function getTemplates(): Promise<TemplateRecord[]> {
  try {
    const base = getApiUrl().replace(/\/$/, '');
    const response = await fetch(`${base}/templates`, {
      next: { revalidate: 3600 },
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Templates request failed (${response.status}).`);
    const body: unknown = await response.json();
    if (!Array.isArray(body) || !body.every(isTemplateRecord)) {
      throw new Error('Templates response has an unexpected shape.');
    }
    return body;
  } catch {
    if (!fallbackWarned) {
      fallbackWarned = true;
      // eslint-disable-next-line no-console
      console.warn('[templates] API unreachable — rendering an empty catalog.');
    }
    return [];
  }
}
