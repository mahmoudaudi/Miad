'use client';

import { usePathname, useRouter } from 'next/navigation';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { AiStudioWorkspaceChrome, type StudioProfile } from '@/components/invitations/AiStudioView';
import { useToast } from '@/components/ui/ToastProvider';
import { AuthUser, getCurrentUser, logout } from '@/lib/auth';
import { ADMIN_HOME_PATH, isAdminRole } from '@/lib/admin-auth';
import { AUTH_SUCCESS_MESSAGES, withAuthFeedback } from '@/lib/auth-feedback';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { NotificationSoundWatcher } from '@/components/notifications/NotificationSoundWatcher';

const SessionContext = createContext<AuthUser | null>(null);
const WorkspaceActionsContext = createContext<{
  loggingOut: boolean;
  onLogout: () => void;
} | null>(null);

export function isAiStudioPath(pathname: string | null): boolean {
  return pathname?.replace(/\/+$/, '') === '/dashboard/invitations/new';
}

export type DashboardGuardDecision =
  { type: 'allow' } | { type: 'deny-login' } | { type: 'deny-admin' };

/**
 * Pure routing decision for the dashboard guard. Admins are denied the
 * normal dashboard (they belong on the admin portal); the caller redirects
 * and must not store or render the admin session here.
 */
export function decideDashboardAccess(user: AuthUser | null): DashboardGuardDecision {
  if (!user) return { type: 'deny-login' };
  if (isAdminRole(user.role)) return { type: 'deny-admin' };
  return { type: 'allow' };
}

export function useDashboardSession(): AuthUser {
  const user = useContext(SessionContext);
  if (!user) throw new Error('useDashboardSession must be used inside DashboardShell.');
  return user;
}

export function useWorkspaceActions() {
  const actions = useContext(WorkspaceActionsContext);
  if (!actions) throw new Error('useWorkspaceActions must be used inside DashboardShell.');
  return actions;
}

function StudioLoading({ label, aiStudio }: { label: string; aiStudio: boolean }) {
  if (!aiStudio) {
    return (
      <main
        aria-busy="true"
        aria-live="polite"
        className="miad-studio-theme min-h-[100dvh] bg-[#f1f3f5] px-4 py-8 text-[#20242a] sm:px-6"
      >
        <span className="sr-only">{label}</span>
        <div className="mx-auto h-32 max-w-6xl animate-pulse rounded-2xl border border-[#d7dbe0] bg-white" />
      </main>
    );
  }

  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="miad-studio-theme min-h-[100dvh] bg-[#f1f3f5] lg:h-[100dvh] lg:overflow-hidden"
    >
      <span className="sr-only">{label}</span>
      <div
        aria-hidden="true"
        className="grid h-12 grid-cols-[minmax(0,1fr)_auto] border-b border-[#cfd4da] bg-[#f8fafc] lg:grid-cols-[224px_430px_minmax(0,1fr)]"
      >
        <div className="flex items-center gap-2 border-e border-[#d7dbe0] px-3">
          <div className="h-6 w-10 animate-pulse rounded bg-[#d1d5db]" />
          <div className="h-3 w-14 animate-pulse rounded bg-[#d1d5db]" />
        </div>
        <div className="hidden items-center border-e border-[#d7dbe0] px-3 lg:flex">
          <div className="h-3 w-28 animate-pulse rounded bg-[#d1d5db]" />
        </div>
        <div className="flex items-center justify-end px-3">
          <div className="size-8 animate-pulse rounded-full bg-[#cbd5e1]" />
        </div>
      </div>
      <div className="lg:grid lg:h-[calc(100dvh-48px)] lg:grid-cols-[224px_430px_minmax(0,1fr)] lg:overflow-hidden">
        <div className="hidden border-e border-[#d7dbe0] bg-[#f8fafc] p-3 lg:block">
          <div className="h-9 animate-pulse rounded-md bg-[#e2e8f0]" />
          <div className="mt-8 space-y-3">
            <div className="h-9 animate-pulse rounded-md bg-[#e2e8f0]" />
            <div className="h-9 animate-pulse rounded-md bg-[#e2e8f0]" />
            <div className="h-9 animate-pulse rounded-md bg-[#e2e8f0]" />
            <div className="h-9 animate-pulse rounded-md bg-[#e2e8f0]" />
          </div>
        </div>
        <div className="hidden min-h-0 border-e border-[#d7dbe0] bg-[#f8fafc] p-3 lg:block">
          <div className="h-full animate-pulse rounded-lg border border-[#dbe1e8] bg-white" />
        </div>
        <div className="hidden min-h-0 bg-[#e5e7eb] p-5 lg:block">
          <div className="mx-auto h-full max-w-[42rem] animate-pulse rounded-lg border border-[#cbd5e1] bg-white" />
        </div>
      </div>
    </main>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useLocale();
  const showToast = useToast();
  const t = getDictionary(locale);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const isAiStudio = isAiStudioPath(pathname);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const current = await getCurrentUser();
      const decision = decideDashboardAccess(current);
      if (decision.type === 'deny-login') {
        router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      // Authoritative backstop: admins must never render normal dashboard
      // UI, even when navigating to /dashboard/* manually. Do not store the
      // admin session here and do not render children below.
      if (decision.type === 'deny-admin') {
        router.replace(ADMIN_HOME_PATH);
        return;
      }
      if (current) setUser(current);
    } catch {
      setError(t.dashboard.accountLoadFailed);
    } finally {
      setLoading(false);
    }
  }, [router, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setActionError(null);
    try {
      await withAuthFeedback(
        () => logout(),
        AUTH_SUCCESS_MESSAGES.logout,
        t.dashboard.logoutFailed,
        showToast
      );
      router.replace('/');
      router.refresh();
    } catch {
      setActionError(t.dashboard.logoutFailed);
      setLoggingOut(false);
    }
  }

  if (loading || (!user && !error)) {
    return <StudioLoading label={t.dashboard.workspaceLoading} aiStudio={isAiStudio} />;
  }
  if (error || !user) {
    return (
      <div className="miad-studio-theme flex min-h-screen items-center justify-center bg-[#f1f3f5] px-4">
        <section className="w-full max-w-lg rounded-2xl border border-line bg-surface p-8 text-center shadow-subtle">
          <h1 className="font-display text-headline-md text-ink">
            {t.dashboard.workspaceUnavailable}
          </h1>
          <p role="alert" className="miad-feedback-enter mt-3 text-body-md text-muted">
            {error}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-7 rounded-xl bg-primary px-5 py-3 text-label-md text-white"
          >
            {t.common.tryAgain}
          </button>
        </section>
      </div>
    );
  }

  return (
    <SessionContext.Provider value={user}>
      <NotificationSoundWatcher userId={user.id} inboxPath="/dashboard/notifications" />
      <WorkspaceActionsContext.Provider value={{ loggingOut, onLogout: () => void handleLogout() }}>
        {isAiStudio ? (
          children
        ) : (
          <AiStudioWorkspaceChrome
            showHeader={false}
            profile={
              {
                name: `${user.firstName} ${user.lastName}`.trim() || 'Your account',
                email: user.email,
                initials:
                  `${user.firstName.trim().charAt(0)}${user.lastName.trim().charAt(0)}`.toUpperCase() ||
                  'M',
              } satisfies StudioProfile
            }
            loggingOut={loggingOut}
            onLogout={() => void handleLogout()}
          >
            {actionError && (
              <p
                role="alert"
                className="miad-feedback-enter mx-auto max-w-6xl px-4 pt-4 text-sm text-[#9f1239] sm:px-6"
              >
                {actionError}
              </p>
            )}
            {children}
          </AiStudioWorkspaceChrome>
        )}
      </WorkspaceActionsContext.Provider>
    </SessionContext.Provider>
  );
}
