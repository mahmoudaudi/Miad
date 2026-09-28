import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  adoptPendingInvitationPrompt,
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

  it('discards a prompt stamped for another account', () => {
    const sessionStorage = memoryStorage();
    vi.stubGlobal('window', { sessionStorage });

    savePendingInvitationPrompt('Account A prompt', 'account-a');
    expect(readPendingInvitationPrompt('account-b')).toBeNull();
    // The foreign prompt is removed so it cannot apply later either.
    expect(sessionStorage.getItem(PENDING_INVITATION_PROMPT_KEY)).toBeNull();
  });

  it('returns an ownerless prompt to anyone until it is adopted', () => {
    const sessionStorage = memoryStorage();
    vi.stubGlobal('window', { sessionStorage });

    savePendingInvitationPrompt('Anonymous prompt');
    expect(readPendingInvitationPrompt('account-b')).toBe('Anonymous prompt');

    adoptPendingInvitationPrompt('account-b');
    expect(readPendingInvitationPrompt('account-b')).toBe('Anonymous prompt');
    expect(readPendingInvitationPrompt('account-c')).toBeNull();
  });
});
