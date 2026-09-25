'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Popover } from './Popover';

export function ShareButton({ url, title }: { url: string; title: string }) {
  const [state, setState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle');
  const [nativeShare, setNativeShare] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  useEffect(() => {
    setNativeShare(typeof navigator.share === 'function');
  }, []);
  useEffect(() => {
    if (state !== 'copied') return;
    const timer = setTimeout(() => setState('idle'), 2000);
    return () => clearTimeout(timer);
  }, [state]);
  async function copy() {
    if (locked.current) return;
    locked.current = true;
    setState('copying');
    setError('');
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(new URL(url, window.location.origin).href);
      setState('copied');
    } catch {
      setState('error');
      setError('Copy failed. Select and copy the invitation link below.');
    } finally {
      locked.current = false;
    }
  }
  async function share() {
    if (locked.current) return;
    locked.current = true;
    setError('');
    try {
      await navigator.share({ title, url: new URL(url, window.location.origin).href });
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError'))
        setError('Sharing is unavailable. Try copying the link.');
    } finally {
      locked.current = false;
    }
  }
  return (
    <Popover
      label="Share invitation"
      align="start"
      triggerClassName="border border-line bg-surface"
      trigger={
        <>
          <span aria-hidden="true" className="material-symbols-outlined text-lg">
            ios_share
          </span>
          Share
        </>
      }
    >
      <p className="px-3 py-2 text-xs font-medium text-muted">Invite people to your occasion</p>
      <button
        type="button"
        className="miad-menu-item"
        aria-disabled={state === 'copying'}
        onClick={() => void copy()}
      >
        <span aria-hidden="true" className="material-symbols-outlined text-lg">
          {state === 'copied' ? 'check' : 'content_copy'}
        </span>
        {state === 'copied' ? 'Link copied' : state === 'copying' ? 'Copying…' : 'Copy link'}
      </button>
      {nativeShare && (
        <button type="button" className="miad-menu-item" onClick={() => void share()}>
          More sharing options
        </button>
      )}
      <div className="px-3 pb-2" aria-live="polite">
        {state === 'copied' && <p className="text-xs text-success">Link copied. Ready to share.</p>}
        {error && (
          <p role="alert" className="mb-2 text-xs text-error">
            {error}
          </p>
        )}
        <label className="mt-2 block text-xs text-muted">
          Invitation link
          <input
            readOnly
            value={url}
            onFocus={(event) => event.target.select()}
            className="miad-input mt-1 !text-xs"
          />
        </label>
      </div>
    </Popover>
  );
}
