import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearPendingInvitationPrompt,
  PENDING_INVITATION_PROMPT_KEY,
  readPendingInvitationPrompt,
  savePendingInvitationPrompt,
} from './pending-invitation-prompt';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('pending invitation prompt', () => {
  it('saves a trimmed prompt for the current browser session', () => {
    const sessionStorage = memoryStorage();
    vi.stubGlobal('window', { sessionStorage });

    expect(savePendingInvitationPrompt('  A garden wedding in Beirut  ')).toBe(true);
    expect(readPendingInvitationPrompt()).toBe('A garden wedding in Beirut');
  });

  it('clears consumed prompts and rejects malformed storage', () => {
    const sessionStorage = memoryStorage();
    vi.stubGlobal('window', { sessionStorage });

    savePendingInvitationPrompt('Dinner on the terrace');
    clearPendingInvitationPrompt();
    expect(readPendingInvitationPrompt()).toBeNull();

    sessionStorage.setItem(PENDING_INVITATION_PROMPT_KEY, '{not-json');
    expect(readPendingInvitationPrompt()).toBeNull();
    expect(sessionStorage.getItem(PENDING_INVITATION_PROMPT_KEY)).toBeNull();
  });
});
