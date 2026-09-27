'use client';

import React, { useEffect, useRef, useState } from 'react';

type SharePayload = { title: string; url: string };
type ShareActions = {
  origin: string;
  clipboard?: Pick<Clipboard, 'writeText'>;
  share?: (payload: SharePayload) => Promise<void>;
};

function absoluteInvitationUrl(url: string, origin: string): string {
  return new URL(url, origin).href;
}

export async function copyInvitationLink(
  url: string,
  clipboard: Pick<Clipboard, 'writeText'> | undefined,
  origin: string
): Promise<void> {
  if (!clipboard) throw new Error('Clipboard unavailable');
  await clipboard.writeText(absoluteInvitationUrl(url, origin));
}

export async function performInvitationShare(
  url: string,
  title: string,
  actions: ShareActions
): Promise<'shared' | 'copied'> {
  const payload = { title, url: absoluteInvitationUrl(url, actions.origin) };
  if (actions.share) {
    await actions.share(payload);
    return 'shared';
  }
  if (!actions.clipboard) throw new Error('Clipboard unavailable');
  await actions.clipboard.writeText(payload.url);
  return 'copied';
}

const actionClass =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-label-md text-ink transition duration-200 ease-out hover:-translate-y-px hover:border-muted hover:shadow-sm active:translate-y-0 disabled:cursor-wait disabled:opacity-60';

export function ShareButton({ url, title }: { url: string; title: string }) {
  const [state, setState] = useState<'idle' | 'copying' | 'copied' | 'shared' | 'error'>('idle');
  const [error, setError] = useState('');
  const locked = useRef(false);

  useEffect(() => {
    if (state !== 'copied' && state !== 'shared') return;
    const timer = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [state]);

  async function copy() {
    if (locked.current || !url) return;
    locked.current = true;
    setState('copying');
    setError('');
    try {
      await copyInvitationLink(url, navigator.clipboard, window.location.origin);
      setState('copied');
    } catch {
      setState('error');
      setError('Copy failed. Please try again.');
    } finally {
      locked.current = false;
    }
  }

  async function share() {
    if (locked.current || !url) return;
    locked.current = true;
    setError('');
    try {
      const result = await performInvitationShare(url, title, {
        origin: window.location.origin,
        clipboard: navigator.clipboard,
        share: navigator.share ? (payload) => navigator.share(payload) : undefined,
      });
      setState(result === 'copied' ? 'copied' : 'shared');
    } catch (shareError) {
      if (shareError instanceof Error && shareError.name === 'AbortError') {
        setState('idle');
      } else {
        setState('error');
        setError('Sharing failed. You can copy the invitation link instead.');
      }
    } finally {
      locked.current = false;
    }
  }

  if (!url) return null;

  return (
    <div className="inline-flex flex-wrap gap-2">
      <button
        type="button"
        className={actionClass}
        onClick={() => void copy()}
        disabled={state === 'copying'}
      >
        <span aria-hidden="true" className="material-symbols-outlined text-lg">
          {state === 'copied' ? 'check' : 'content_copy'}
        </span>
        {state === 'copying' ? 'Copying…' : state === 'copied' ? 'Copied!' : 'Copy link'}
      </button>
      <button
        type="button"
        className={actionClass}
        onClick={() => void share()}
        disabled={state === 'copying'}
      >
        <span aria-hidden="true" className="material-symbols-outlined text-lg">
          {state === 'shared' ? 'check' : 'ios_share'}
        </span>
        {state === 'shared' ? 'Shared!' : 'Share'}
      </button>
      <span className="sr-only" aria-live="polite">
        {state === 'copied' && 'Invitation link copied.'}
        {state === 'shared' && 'Invitation shared.'}
      </span>
      {error && (
        <p role="alert" className="miad-feedback-enter basis-full text-xs text-error">
          {error}
        </p>
      )}
    </div>
  );
}
