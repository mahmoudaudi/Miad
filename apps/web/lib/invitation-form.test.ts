import { describe, expect, it } from 'vitest';
import { normalizeInvitationSlug, validateInvitationSlug } from './invitation-form';

describe('invitation slug validation', () => {
  it('normalizes valid slugs', () => {
    expect(normalizeInvitationSlug('  Maya-And-Sami  ')).toBe('maya-and-sami');
    expect(validateInvitationSlug('  Maya-And-Sami  ')).toBeNull();
  });

  it('rejects empty, short, malformed, and oversized slugs', () => {
    expect(validateInvitationSlug(' ')).toContain('required');
    expect(validateInvitationSlug('ab')).toContain('at least');
    expect(validateInvitationSlug('two--hyphens')).toContain('single hyphens');
    expect(validateInvitationSlug('bad slug')).toContain('lowercase letters');
    expect(validateInvitationSlug('a'.repeat(256))).toContain('255');
  });
});
