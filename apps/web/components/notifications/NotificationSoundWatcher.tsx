'use client';

import { useEffect, useState } from 'react';
import { listNotifications, notifyNotificationChange } from '@/lib/notifications';

const POLL_MS = 5000;

/** A short, quiet two-note chime; no external audio asset or permission prompt. */
function playChime(context: AudioContext) {
  const start = context.currentTime;
  for (const [frequency, offset] of [[660, 0], [880, 0.13]] as const) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start + offset);
    gain.gain.exponentialRampToValueAtTime(0.07, start + offset + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.22);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start + offset);
    oscillator.stop(start + offset + 0.23);
  }
}

const PROMPT_DISMISSED_KEY = 'miad:notification-permission-dismissed';

export function NotificationSoundWatcher({ userId, inboxPath }: { userId: string; inboxPath: string }) {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    setShowPrompt(
      typeof Notification !== 'undefined' &&
      window.isSecureContext &&
      Notification.permission === 'default' &&
      localStorage.getItem(PROMPT_DISMISSED_KEY) !== 'true'
    );
  }, []);

  const dismissPrompt = () => {
    localStorage.setItem(PROMPT_DISMISSED_KEY, 'true');
    setShowPrompt(false);
  };

  const allowNotifications = async () => {
    // Browsers only show their permission dialog in response to this click.
    try { await Notification.requestPermission(); } catch { /* Browser declined or blocked it. */ }
    dismissPrompt();
  };

  useEffect(() => {
    let active = true;
    let latestSeenAt: number | null = null;
    let audio: AudioContext | null = null;
    let unlocked = false;
    let polling = false;

    const unlockAudio = () => {
      try {
        audio ??= new AudioContext();
        void audio.resume().then(() => { unlocked = true; }).catch(() => {});
      } catch {
        // Unsupported browser: visual notifications continue normally.
      }
    };
    const poll = async () => {
      if (!active || polling) return;
      polling = true;
      try {
        const page = await listNotifications();
        if (!active) return;
        const newestAt = Math.max(0, ...page.items.map((item) => Date.parse(item.createdAt) || 0));
        const hasNewUnread = latestSeenAt !== null && page.items.some((item) =>
          !item.isRead && Date.parse(item.createdAt) > latestSeenAt!
        );
        if (hasNewUnread) {
          notifyNotificationChange();
          if (unlocked && audio?.state === 'running') playChime(audio);
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            const newest = page.items.find((item) => !item.isRead && Date.parse(item.createdAt) > latestSeenAt!);
            if (newest) {
              try {
                const alert = new Notification(newest.title, { body: newest.message, tag: newest.id });
                alert.onclick = () => { window.focus(); window.location.assign(inboxPath); alert.close(); };
              } catch { /* Permission may have changed between checks. */ }
            }
          }
        }
        latestSeenAt = Math.max(latestSeenAt ?? 0, newestAt);
      } catch {
        // Keep the baseline: a failed request must not trigger a false arrival.
      } finally {
        polling = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    window.addEventListener('focus', poll);
    document.addEventListener('visibilitychange', poll);
    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    if (navigator.userActivation?.hasBeenActive) unlockAudio();
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', poll);
      document.removeEventListener('visibilitychange', poll);
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      void audio?.close();
    };
  }, [userId, inboxPath]);

  return showPrompt ? (
    <aside role="dialog" aria-label="Enable notification alerts" className="fixed bottom-4 left-4 right-4 z-[100] max-w-sm rounded-2xl border border-line bg-surface p-4 text-ink shadow-xl sm:left-auto sm:right-6">
      <p className="text-sm font-semibold">Get notification alerts?</p>
      <p className="mt-1 text-xs text-muted">Allow browser alerts for new updates while Miad is open.</p>
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => void allowNotifications()} className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white">Allow notifications</button>
        <button type="button" onClick={dismissPrompt} className="rounded-lg border border-line px-4 py-2 text-xs text-ink">Not now</button>
      </div>
    </aside>
  ) : null;
}
