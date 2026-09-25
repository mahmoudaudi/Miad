export const INVITATION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeInvitationSlug(value: string): string {
  return value.trim().toLowerCase();
}

export function validateInvitationSlug(value: string): string | null {
  const slug = normalizeInvitationSlug(value);
  if (!slug) return 'Slug is required.';
  if (slug.length < 3) return 'Slug must be at least 3 characters.';
  if (slug.length > 255) return 'Slug must be 255 characters or fewer.';
  if (!INVITATION_SLUG_PATTERN.test(slug)) {
    return 'Use lowercase letters, numbers, and single hyphens only.';
  }
  return null;
}
