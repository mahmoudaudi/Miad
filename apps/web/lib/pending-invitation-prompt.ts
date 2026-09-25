export const PENDING_INVITATION_PROMPT_KEY = 'miad.pending-invitation-prompt';
export const PENDING_PROMPT_AUTH_EVENT = 'miad:pending-prompt-auth';
export const PENDING_PROMPT_TARGET = '/dashboard/invitations/new';

const MAX_PROMPT_LENGTH = 2000;
const MAX_PROMPT_AGE_MS = 24 * 60 * 60 * 1000;

type StoredPrompt = {
  prompt: string;
  savedAt: number;
};

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function savePendingInvitationPrompt(value: string): boolean {
  const prompt = value.trim().slice(0, MAX_PROMPT_LENGTH);
  if (!prompt) return false;
  try {
    storage()?.setItem(
      PENDING_INVITATION_PROMPT_KEY,
      JSON.stringify({ prompt, savedAt: Date.now() } satisfies StoredPrompt)
    );
    return Boolean(storage());
  } catch {
    return false;
  }
}

export function readPendingInvitationPrompt(): string | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(PENDING_INVITATION_PROMPT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredPrompt>;
    const prompt = typeof parsed.prompt === 'string' ? parsed.prompt.trim() : '';
    const savedAt = typeof parsed.savedAt === 'number' ? parsed.savedAt : 0;
    if (!prompt || prompt.length > MAX_PROMPT_LENGTH || Date.now() - savedAt > MAX_PROMPT_AGE_MS) {
      store.removeItem(PENDING_INVITATION_PROMPT_KEY);
      return null;
    }
    return prompt;
  } catch {
    store.removeItem(PENDING_INVITATION_PROMPT_KEY);
    return null;
  }
}

export function clearPendingInvitationPrompt(): void {
  try {
    storage()?.removeItem(PENDING_INVITATION_PROMPT_KEY);
  } catch {
    // Storage can be unavailable in privacy-restricted browser contexts.
  }
}
