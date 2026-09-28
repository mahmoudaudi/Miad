'use client';

import Image from 'next/image';
import React, { useRef } from 'react';
import { useOverlay } from '@/components/ui/useOverlay';
import { LoginForm, RegisterForm } from '@/components/auth/AuthForms';
import type { AuthUser } from '@/lib/auth';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { BRAND_BLUR_DATA_URL } from './LandingSkeleton';
import type { Locale } from '@/lib/i18n/locales';

export type AuthMode = 'login' | 'register';

/**
 * Auth modal — product branding with the logo on top.
 * Closes on backdrop click, Escape, or the X button.
 */
export function AuthModal({
  mode,
  locale,
  notice,
  onModeChange,
  onClose,
  onSuccess,
}: {
  mode: AuthMode;
  locale: Locale;
  notice?: string | null;
  onModeChange: (mode: AuthMode) => void;
  onClose: () => void;
  onSuccess: (user: AuthUser) => void;
}) {
  const dict = getDictionary(locale);
  const t = dict.auth;
  const panelRef = useRef<HTMLDivElement>(null);
  useOverlay(true, panelRef, onClose);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'login' ? t.login : t.createAccount}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="animate-modal-pop relative max-h-[calc(100dvh-1rem)] w-full max-w-sm overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-lift sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {notice && (
          <div
            role="status"
            className="mb-4 flex items-start gap-3 rounded-xl border border-primary/20 bg-secondary py-3 pe-12 ps-4 text-start text-body-sm text-ink"
          >
            <span
              className="material-symbols-outlined mt-0.5 text-lg text-primary"
              aria-hidden="true"
            >
              check_circle
            </span>
            <span>{notice}</span>
          </div>
        )}
        <div className="mb-4 flex flex-col items-center text-center">
          <Image
            alt={dict.nav.logo}
            className="h-16 w-auto max-w-[160px] object-contain"
            placeholder="blur"
            blurDataURL={BRAND_BLUR_DATA_URL}
            src="/miad-logo.png"
            width={180}
            height={120}
          />
          <h2 className="mt-3 font-display text-2xl text-ink">
            {mode === 'login' ? t.welcomeBack : t.createAccountTitle}
          </h2>
          <p className="mt-1.5 text-body-sm text-muted">
            {mode === 'login' ? t.welcomeBackSubtitle : t.createAccountSubtitle}
          </p>
        </div>
        <div className="mb-4 flex gap-1 rounded-xl border border-line bg-background p-1">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              aria-pressed={mode === m}
              className={`flex-1 rounded-lg px-3 py-1.5 text-label-md transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                mode === m ? 'bg-surface text-ink shadow-subtle' : 'text-muted hover:text-ink'
              }`}
            >
              {m === 'login' ? t.login : t.signup}
            </button>
          ))}
        </div>
        {mode === 'login' ? (
          <LoginForm
            locale={locale}
            onSuccess={onSuccess}
            onSwitch={() => onModeChange('register')}
          />
        ) : (
          <RegisterForm
            locale={locale}
            onSuccess={onSuccess}
            onSwitch={() => onModeChange('login')}
          />
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label={dict.common.close}
          className="absolute end-4 top-4 flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:h-9 sm:w-9"
        >
          <span className="material-symbols-outlined text-muted" aria-hidden="true">
            close
          </span>
        </button>
      </div>
    </div>
  );
}
