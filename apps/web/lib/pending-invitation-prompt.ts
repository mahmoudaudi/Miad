export const PENDING_INVITATION_PROMPT_KEY = 'miad.pending-invitation-prompt';
export const PENDING_PROMPT_AUTH_EVENT = 'miad:pending-prompt-auth';
export const PENDING_PROMPT_TARGET = '/dashboard/invitations/new';

const MAX_PROMPT_LENGTH = 2000;
const MAX_PROMPT_AGE_MS = 24 * 60 * 60 * 1000;

type StoredPrompt = {
  prompt: string;
  savedAt: number;
  /** Account that typed the prompt, when known. Guards cross-account reuse. */
  ownerId: string | null;
};

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function savePendingInvitationPrompt(value: string, ownerId: string | null = null): boolean {
  const prompt = value.trim().slice(0, MAX_PROMPT_LENGTH);
  if (!prompt) return false;
  try {
    storage()?.setItem(
      PENDING_INVITATION_PROMPT_KEY,
      JSON.stringify({ prompt, savedAt: Date.now(), ownerId } satisfies StoredPrompt)
    );
    return Boolean(storage());
  } catch {
    return false;
  }
}

function parseStoredPrompt(raw: string | null): StoredPrompt | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredPrompt>;
    const prompt = typeof parsed.prompt === 'string' ? parsed.prompt.trim() : '';
    const savedAt = typeof parsed.savedAt === 'number' ? parsed.savedAt : 0;
    const ownerId = typeof parsed.ownerId === 'string' ? parsed.ownerId : null;
    if (!prompt || prompt.length > MAX_PROMPT_LENGTH || Date.now() - savedAt > MAX_PROMPT_AGE_MS) {
      return null;
    }
    return { prompt, savedAt, ownerId };
  } catch {
    return null;
  }
}

export function readPendingInvitationPrompt(expectedOwnerId?: string | null): string | null {
  const store = storage();
  if (!store) return null;
  const stored = parseStoredPrompt(store.getItem(PENDING_INVITATION_PROMPT_KEY));
  if (!stored) {
    store.removeItem(PENDING_INVITATION_PROMPT_KEY);
    return null;
  }
  // A prompt stamped for another account must never be applied here.
  if (stored.ownerId && expectedOwnerId && stored.ownerId !== expectedOwnerId) {
    store.removeItem(PENDING_INVITATION_PROMPT_KEY);
    return null;
  }
  return stored.prompt;
}

/**
 * Binds an ownerless (anonymously saved) prompt to the just-authenticated
 * account, so a later account switch discards it instead of applying it.
 */
export function adoptPendingInvitationPrompt(ownerId: string): void {
  const store = storage();
  if (!store) return;
  const stored = parseStoredPrompt(store.getItem(PENDING_INVITATION_PROMPT_KEY));
  if (!stored || stored.ownerId) return;
  try {
    store.setItem(
      PENDING_INVITATION_PROMPT_KEY,
      JSON.stringify({ ...stored, ownerId } satisfies StoredPrompt)
    );
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}

export function clearPendingInvitationPrompt(): void {
  try {
    storage()?.removeItem(PENDING_INVITATION_PROMPT_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}
