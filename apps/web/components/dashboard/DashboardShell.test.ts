import { describe, expect, it } from 'vitest';
import { isAiStudioPath } from './DashboardShell';

describe('isAiStudioPath', () => {
  it('recognizes AI Studio routes with or without a trailing slash', () => {
    expect(isAiStudioPath('/dashboard/invitations/new')).toBe(true);
    expect(isAiStudioPath('/dashboard/invitations/new/')).toBe(true);
    expect(isAiStudioPath('/dashboard/invitations')).toBe(false);
    expect(isAiStudioPath(null)).toBe(false);
  });
});
