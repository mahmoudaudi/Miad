'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { RegisterForm } from '@/components/auth/AuthForms';
import { getCurrentUser } from '@/lib/auth';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import {
  PENDING_PROMPT_TARGET,
  readPendingInvitationPrompt,
} from '@/lib/pending-invitation-prompt';

/** Registration page — Editorial card wrapping the shared form. */
export default function RegisterPage() {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getDictionary(locale).auth;
  const [sessionState, setSessionState] = useState<'checking' | 'anonymous' | 'error'>('checking');

  const checkSession = useCallback(async () => {
    setSessionState('checking');
    try {
      const user = await getCurrentUser();
      if (user) {
        router.replace(readPendingInvitationPrompt() ? PENDING_PROMPT_TARGET : '/dashboard/invitations/new');
        router.refresh();
        return;
      }
      setSessionState('anonymous');
    } catch {
      setSessionState('error');
    }
  }, [router]);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const goDashboard = () => {
    router.replace(readPendingInvitationPrompt() ? PENDING_PROMPT_TARGET : '/dashboard/invitations/new');
    router.refresh();
  };

  if (sessionState !== 'anonymous') {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md bg-surface border border-line rounded-2xl shadow-subtle p-8 text-center">
          {sessionState === 'checking' ? (
            <div role="status" aria-busy="true">
              <div className="mx-auto mb-4 h-2 w-24 animate-pulse rounded-full bg-primary/20" />
              <p className="text-body-md text-muted">{t.checkingSession}</p>
            </div>
          ) : (
            <>
              <p role="alert" className="text-body-md text-error mb-4">
                {t.sessionCheckFailed}
              </p>
              <button
                type="button"
                onClick={() => void checkSession()}
                className="px-5 py-2 rounded-xl border border-line text-label-md text-ink hover:border-muted/50"
              >
                {t.retryAccount}
              </button>
            </>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-subtle sm:p-8">
        <Link
          href="/"
          aria-label="Miad home"
          className="mb-6 inline-block font-wordmark text-5xl text-primary"
        >
          Miad
        </Link>
        <h1 className="mb-1.5 font-display text-2xl text-ink">{t.createAccountTitle}</h1>
        <p className="mb-5 text-body-sm text-muted">{t.createAccountSubtitle}</p>
        <RegisterForm
          locale={locale}
          onSuccess={goDashboard}
          onSwitch={() => router.push('/login')}
        />
      </div>
    </main>
  );
}
