'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useOverlay } from './useOverlay';
import styles from './ShareButton.module.css';

type SharePayload = { title: string; url: string };
type ShareActions = {
  origin: string;
  clipboard?: Pick<Clipboard, 'writeText'>;
  share?: (payload: SharePayload) => Promise<void>;
};
export type InvitationSharePlatform =
  | 'whatsapp'
  | 'instagram'
  | 'facebook'
  | 'x'
  | 'telegram'
  | 'email';

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

export function invitationShareHref(
  platform: InvitationSharePlatform,
  url: string,
  title: string,
  origin: string
): string | null {
  const invitationUrl = absoluteInvitationUrl(url, origin);
  const text = title.trim();
  switch (platform) {
    case 'whatsapp':
      return `https://wa.me/?text=${encodeURIComponent(`${text} ${invitationUrl}`.trim())}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(invitationUrl)}`;
    case 'x':
      return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(invitationUrl)}`;
    case 'telegram':
      return `https://t.me/share/url?url=${encodeURIComponent(invitationUrl)}&text=${encodeURIComponent(text)}`;
    case 'email':
      return `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(`${text}\n${invitationUrl}`.trim())}`;
    case 'instagram':
      return null;
  }
}

export async function performInstagramShare(
  url: string,
  title: string,
  actions: ShareActions
): Promise<'shared' | 'copied'> {
  return performInvitationShare(url, title, actions);
}

const platformOptions: Array<{
  id: InvitationSharePlatform;
  label: string;
  detail: string;
}> = [
  { id: 'whatsapp', label: 'WhatsApp', detail: 'Send a message' },
  { id: 'instagram', label: 'Instagram', detail: 'Copy link to share' },
  { id: 'facebook', label: 'Facebook', detail: 'Share a post' },
  { id: 'x', label: 'X / Twitter', detail: 'Post an invitation' },
  { id: 'telegram', label: 'Telegram', detail: 'Send to a chat' },
  { id: 'email', label: 'Email', detail: 'Write an email' },
];

function PlatformIcon({ platform }: { platform: InvitationSharePlatform | 'copy' }) {
  const common = {
    viewBox: '0 0 24 24',
    'aria-hidden': true as const,
    focusable: false as const,
    className: styles.icon,
  };

  if (platform === 'instagram') {
    return (
      <svg {...common} viewBox="0 0 24 24" fill="none">
        <rect x="3.5" y="3.5" width="17" height="17" rx="5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="17.7" cy="6.6" r="1.1" fill="currentColor" />
      </svg>
    );
  }
  if (platform === 'facebook') {
    return (
      <svg {...common} viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.5 21v-8h2.7l.4-3.1h-3.1v-2c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.1H7.3V13h2.8v8h3.4Z" />
      </svg>
    );
  }
  if (platform === 'x') {
    return (
      <svg {...common} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.8 5.7 22H2.5l7.3-8.4L1.8 2h6.5l4.5 6.7L18.9 2Zm-1.1 17.9h1.7L7.3 4H5.5l12.3 15.9Z" />
      </svg>
    );
  }
  if (platform === 'telegram') {
    return (
      <svg {...common} viewBox="0 0 24 24" fill="currentColor">
        <path d="m21.7 4.4-3.2 15.1c-.2 1.1-.9 1.4-1.8.9l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.3L5.9 13l-5-1.6c-1.1-.3-1.1-1.1.2-1.6L20.7 2.5c1-.4 1.8.2 1 1.9Z" />
      </svg>
    );
  }
  if (platform === 'whatsapp') {
    return (
      <svg {...common} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2a9.8 9.8 0 0 0-8.4 14.8L2.3 22l5.3-1.4A9.9 9.9 0 1 0 12 2Zm0 17.9c-1.4 0-2.7-.4-3.9-1.1l-.3-.2-3.1.8.8-3-.2-.4A8 8 0 1 1 12 19.9Zm4.4-6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.8.9-.3.2-.5.1a6.6 6.6 0 0 1-1.9-1.2 7 7 0 0 1-1.3-1.6c-.1-.2 0-.3.1-.4l.4-.5.3-.4v-.4l-.7-1.6c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3s-.9.9-.9 2.1 1 2.4 1.1 2.6a9.5 9.5 0 0 0 3.8 3.3c.5.2.9.4 1.2.4.5.2 1 .1 1.4.1.4-.1 1.4-.6 1.6-1.1.2-.5.2-1 .1-1.1 0-.1-.2-.2-.4-.3Z" />
      </svg>
    );
  }
  if (platform === 'copy') {
    return (
      <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="8" y="8" width="12" height="13" rx="2" />
        <path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2" />
      </svg>
    );
  }
  return (
    <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

export function ShareButton({ url, title }: { url: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<'enter' | 'exit'>('enter');
  const [notice, setNotice] = useState('');
  const [instagramCopied, setInstagramCopied] = useState(false);
  const [nativeAvailable, setNativeAvailable] = useState(false);
  const titleId = useId();
  const descriptionId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function close() {
    if (!open || phase === 'exit') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setOpen(false);
      return;
    }
    setPhase('exit');
    closeTimer.current = setTimeout(() => setOpen(false), 220);
  }

  useOverlay(open, dialog, close);

  useEffect(() => {
    setNativeAvailable(typeof navigator.share === 'function');
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  async function copyLink(forInstagram = false) {
    try {
      await copyInvitationLink(
        url,
        navigator.clipboard,
        window.location.origin
      );
      setInstagramCopied(forInstagram);
      setNotice(
        forInstagram
          ? 'Invitation link copied. Paste it into your Instagram post or message.'
          : 'Invitation link copied to your clipboard.'
      );
    } catch {
      setNotice('Copy failed. Please allow clipboard access and try again.');
    }
  }

  async function shareWithInstagram() {
    if (nativeAvailable) {
      try {
        await performInstagramShare(url, title, {
          origin: window.location.origin,
          clipboard: navigator.clipboard,
          share: (payload) =>
            navigator.share({ ...payload, text: payload.title }),
        });
        setNotice('Choose Instagram or another app from the share sheet.');
        setInstagramCopied(false);
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }
    await copyLink(true);
  }

  if (!url) return null;

  const modal = open && typeof document !== 'undefined' ? (
    <div className={styles.backdrop} data-phase={phase}>
      <div
        className={styles.backdropHit}
        aria-hidden="true"
        onClick={close}
      />
      <section
        ref={dialog}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={styles.dialog}
        data-phase={phase}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.handle} aria-hidden="true" />
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>A moment worth sharing</p>
            <h2 id={titleId} className={styles.title}>Share invitation</h2>
            <p id={descriptionId} className={styles.description}>
              Send the public invitation link to your guests.
            </p>
          </div>
          <button type="button" className={styles.close} onClick={close} aria-label="Close sharing options">
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className={styles.options}>
          {platformOptions.map((option, index) => {
            const style = { '--share-index': index } as React.CSSProperties;
            if (option.id === 'instagram') {
              return (
                <div className={styles.instagramGroup} key={option.id} style={style}>
                  <button type="button" className={styles.option} onClick={() => void shareWithInstagram()}>
                    <span className={`${styles.iconBox} ${styles.instagram}`}><PlatformIcon platform="instagram" /></span>
                    <span className={styles.optionText}><strong>Instagram</strong><small>Share with Instagram</small></span>
                    <span className={styles.optionArrow} aria-hidden="true">↗</span>
                  </button>
                  {instagramCopied && (
                    <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" className={styles.instagramLink}>
                      Open Instagram <span aria-hidden="true">↗</span>
                    </a>
                  )}
                </div>
              );
            }
            const href = invitationShareHref(option.id, url, title, window.location.origin);
            return (
              <a
                key={option.id}
                href={href ?? undefined}
                target={option.id === 'email' ? undefined : '_blank'}
                rel={option.id === 'email' ? undefined : 'noopener noreferrer'}
                className={styles.option}
                style={style}
                onClick={close}
              >
                <span className={`${styles.iconBox} ${styles[option.id]}`}><PlatformIcon platform={option.id} /></span>
                <span className={styles.optionText}><strong>{option.label}</strong><small>{option.detail}</small></span>
                <span className={styles.optionArrow} aria-hidden="true">↗</span>
              </a>
            );
          })}
          <button type="button" className={`${styles.option} ${styles.copyOption}`} onClick={() => void copyLink()} style={{ '--share-index': platformOptions.length } as React.CSSProperties}>
            <span className={`${styles.iconBox} ${styles.copy}`}><PlatformIcon platform="copy" /></span>
            <span className={styles.optionText}><strong>Copy link</strong><small>Paste it anywhere</small></span>
            <span className={styles.optionArrow} aria-hidden="true">{notice.includes('copied') && !instagramCopied ? '✓' : '↗'}</span>
          </button>
        </div>

        {nativeAvailable && (
          <button
            type="button"
            className={styles.nativeShare}
            onClick={() => void performInvitationShare(url, title, {
              origin: window.location.origin,
              clipboard: navigator.clipboard,
              share: (payload) => navigator.share({ ...payload, text: payload.title }),
            }).then(() => setNotice('Invitation shared.')).catch((error: unknown) => {
              if (!(error instanceof Error && error.name === 'AbortError')) setNotice('Sharing failed. Try copying the invitation link.');
            })}
          >
            <span aria-hidden="true">✦</span> More sharing options
          </button>
        )}
        <div className={styles.footer}>
          <span className={styles.linkPreview}>{absoluteInvitationUrl(url, window.location.origin)}</span>
          <p role="status" aria-live="polite" className={styles.notice}>{notice}</p>
          <span className={styles.privacy}>Only the public invitation link is shared.</span>
        </div>
      </section>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Share invitation"
        onClick={() => {
          if (closeTimer.current) clearTimeout(closeTimer.current);
          setPhase('enter');
          setNotice('');
          setInstagramCopied(false);
          setOpen(true);
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.triggerIcon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4" />
        </svg>
        <span>Share</span>
      </button>
      {modal && createPortal(modal, document.body)}
    </>
  );
}
