'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccountMenu } from '@/components/ui/AccountMenu';
import { useToast } from '@/components/ui/ToastProvider';
import { useOverlay } from '@/components/ui/useOverlay';
import { AuthUser, getCurrentUser, logout } from '@/lib/auth';
import { getPostAuthRedirectTarget, getRoleHomePath } from '@/lib/auth-redirect';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { AUTH_SUCCESS_MESSAGES, withAuthFeedback } from '@/lib/auth-feedback';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import { AUTH_MODAL_OPEN_EVENT } from './AuthModalTrigger';
import {
  PENDING_PROMPT_AUTH_EVENT,
  PENDING_PROMPT_TARGET,
  adoptPendingInvitationPrompt,
  readPendingInvitationPrompt,
} from '@/lib/pending-invitation-prompt';
import type { AuthMode } from './AuthModal';
import { BRAND_BLUR_DATA_URL, Skeleton } from './LandingSkeleton';
import { ThemeToggle } from './ThemeToggle';

// The login/register forms only load when the visitor opens the auth modal,
// keeping them out of the initial landing bundle.
const AuthModal = dynamic(
  () => import('./AuthModal').then((module) => ({ default: module.AuthModal })),
  { ssr: false }
);

export type LandingNavLinkDef = { key: 'templates' | 'features' | 'enterprise'; href: string };

/** Navbar destinations — labels resolve from the dictionary (see NAV_LINKS). */
export const NAV_LINK_DEFS: LandingNavLinkDef[] = [
  { key: 'templates', href: '/#templates' },
  { key: 'features', href: '/#features-heading' },
  { key: 'enterprise', href: '/#pricing' },
];

/** @deprecated Prefer NAV_LINK_DEFS + dictionary labels for translations. */
export type LandingNavLink = { label: string; href: string };

const LOGO_URL = '/miad-logo.png';

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

type AuthStatus = 'loading' | 'anonymous' | 'authenticated' | 'error';

type HeaderViewProps = {
  locale?: ReturnType<typeof useLocale>['locale'];
  user: AuthUser | null;
  authStatus: AuthStatus;
  authError: string | null;
  loggingOut: boolean;
  menuOpen: boolean;
  scrolled: boolean;
  activeKey: LandingNavLinkDef['key'] | null;
  onMenuChange: (open: boolean) => void;
  onAuthOpen: (mode: AuthMode) => void;
  onAuthRetry: () => void;
  onLogout: () => void;
};

const headerBase = 'fixed inset-x-3 top-3 z-50 sm:inset-x-5';

const navLinkBase =
  'miad-nav-motion group relative inline-flex min-h-10 items-center justify-center rounded-xl px-3 text-label-md transition-[background-color,color,transform] duration-200 hover:-translate-y-px hover:bg-ink/[0.04] hover:text-ink';

function HeaderActions({
  t,
  authStatus,
  user,
  loggingOut,
  onAuthOpen,
  onAuthRetry,
  onLogout,
}: Pick<
  HeaderViewProps,
  'authStatus' | 'user' | 'loggingOut' | 'onAuthOpen' | 'onAuthRetry' | 'onLogout'
> & {
  t: ReturnType<typeof getDictionary>;
}) {
  if (authStatus === 'loading') {
    // Real pending state: /auth/me is in flight. The placeholders mirror the
    // size of what replaces them, so nothing shifts when the session resolves.
    return (
      <div
        aria-label={t.auth.checkingAccount}
        aria-busy="true"
        className="hidden items-center gap-1.5 lg:flex"
      >
        <span className="sr-only">{t.auth.checkingAccount}</span>
        <Skeleton className="h-10 w-16 rounded-xl" />
        <Skeleton className="h-10 w-[4.5rem] rounded-xl" />
      </div>
    );
  }

  if (authStatus === 'error') {
    return (
      <button
        type="button"
        onClick={onAuthRetry}
        className={`hidden min-h-11 items-center justify-center whitespace-nowrap rounded-xl border border-line bg-surface/80 px-4 text-label-md text-ink transition-colors hover:border-muted/50 hover:bg-surface lg:inline-flex ${focusRing}`}
      >
        {t.auth.retryAccount}
      </button>
    );
  }

  if (authStatus === 'authenticated' && user) {
    return (
      <div className="hidden lg:block">
        <AccountMenu user={user} loggingOut={loggingOut} onLogout={onLogout} compact />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onAuthOpen('login')}
        className={`hidden min-h-10 items-center justify-center whitespace-nowrap rounded-xl px-3 text-label-md font-medium text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink lg:inline-flex ${focusRing}`}
      >
        {t.auth.login}
      </button>
      <button
        type="button"
        onClick={() => onAuthOpen('register')}
        className={`miad-nav-motion hidden min-h-10 items-center justify-center whitespace-nowrap rounded-xl border border-line bg-surface px-3.5 text-label-md font-semibold text-ink transition-[background-color,border-color,box-shadow] duration-200 hover:border-primary/25 hover:bg-secondary/50 hover:shadow-subtle lg:inline-flex ${focusRing}`}
      >
        {t.auth.signup}
      </button>
    </>
  );
}

export function HeaderView({
  locale = 'en',
  user,
  authStatus,
  authError,
  loggingOut,
  menuOpen,
  scrolled,
  activeKey,
  onMenuChange,
  onAuthOpen,
  onAuthRetry,
  onLogout,
}: HeaderViewProps) {
  const t = getDictionary(locale);
  const mobileRef = useRef<HTMLElement>(null);
  useOverlay(menuOpen, mobileRef, () => onMenuChange(false));
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const close = () => {
      if (media.matches) onMenuChange(false);
    };
    media.addEventListener('change', close);
    return () => media.removeEventListener('change', close);
  }, [onMenuChange]);
  const navLinks = useMemo(
    () => NAV_LINK_DEFS.map((item) => ({ ...item, label: t.nav[item.key] })),
    [t]
  );

  return (
    <header dir="ltr" className={headerBase}>
      <div
        className={`mx-auto grid h-16 max-w-[1240px] grid-cols-[auto_1fr_auto] items-center gap-2 rounded-2xl border px-2.5 shadow-[0_12px_32px_rgba(23,23,23,0.08)] backdrop-blur-2xl transition-[background-color,border-color,box-shadow] duration-300 sm:gap-3 sm:px-4 lg:gap-6 lg:px-5 ${
          scrolled || menuOpen
            ? 'border-line/90 bg-surface/95 shadow-[0_16px_38px_rgba(23,23,23,0.11)]'
            : 'border-[rgb(var(--nav-glass-border))]/70 bg-surface/85'
        }`}
      >
        <Link
          href="/"
          aria-label={t.nav.home}
          className={`flex min-h-11 shrink-0 items-center rounded-xl px-1 ${focusRing}`}
        >
          <Image
            alt={t.nav.logo}
            className="h-12 w-[6.25rem] shrink-0 object-contain sm:w-28"
            src={LOGO_URL}
            width={150}
            height={100}
            placeholder="blur"
            blurDataURL={BRAND_BLUR_DATA_URL}
            priority
          />
        </Link>

        <nav
          aria-label={t.nav.landing}
          className="hidden items-center justify-center gap-1 lg:flex"
        >
          {navLinks.map((item) => {
            const active = activeKey === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`${navLinkBase} ${
                  active ? 'bg-secondary/70 font-semibold text-primary' : 'font-medium text-muted'
                } ${focusRing}`}
              >
                <span className="relative z-10">{item.label}</span>
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-4 bottom-1 h-0.5 origin-center rounded-full bg-primary transition-[opacity,transform] ${
                    active
                      ? 'scale-x-100 opacity-100'
                      : 'scale-x-50 opacity-0 group-hover:opacity-40'
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
          <ThemeToggle className="hidden lg:inline-flex" />
          <HeaderActions
            t={t}
            authStatus={authStatus}
            user={user}
            loggingOut={loggingOut}
            onAuthOpen={onAuthOpen}
            onAuthRetry={onAuthRetry}
            onLogout={onLogout}
          />
          <button
            type="button"
            onClick={() => onMenuChange(!menuOpen)}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-menu"
            aria-label={menuOpen ? t.nav.closeMenu : t.nav.openMenu}
            className={`miad-nav-motion flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-ink transition-[background-color,transform] duration-200 hover:scale-[1.03] hover:bg-secondary/60 active:scale-100 lg:hidden ${focusRing}`}
          >
            <span className="material-symbols-outlined text-[22px]" aria-hidden="true">
              {menuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {menuOpen && (
        <>
          <button
            type="button"
            aria-label={t.nav.closeMenu}
            onClick={() => onMenuChange(false)}
            className="fixed inset-x-0 top-20 z-0 h-[calc(100dvh-5rem)] bg-ink/20 backdrop-blur-[2px] lg:hidden"
          />
          <nav
            ref={mobileRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            id="landing-mobile-menu"
            aria-label={t.nav.mobile}
            className="miad-nav-menu-enter absolute inset-x-0 top-[calc(100%+0.625rem)] z-10 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-4 text-start shadow-[0_20px_50px_rgba(23,23,23,0.16)] sm:p-5 lg:hidden"
          >
            <div className="mb-4 flex items-center justify-between border-b border-line px-1 pb-4">
              <div>
                <p className="font-display text-title text-ink">{t.nav.menuTitle}</p>
                <p className="mt-0.5 text-body-sm text-muted">{t.nav.menuDescription}</p>
              </div>
              <div className="flex items-center gap-1">
              <ThemeToggle />
              <button
                type="button"
                aria-label={t.nav.closeMenu}
                className={`flex h-11 w-11 items-center justify-center rounded-xl text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink ${focusRing}`}
                onClick={() => onMenuChange(false)}
              >
                <span className="material-symbols-outlined text-[21px]" aria-hidden="true">
                  close
                </span>
              </button>
              </div>
            </div>
            <ul className="grid gap-2">
              {navLinks.map((item) => {
                const active = activeKey === item.key;
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      onClick={() => onMenuChange(false)}
                      aria-current={active ? 'page' : undefined}
                      className={`group flex min-h-14 items-center justify-between rounded-xl border px-4 text-body-md transition-colors ${
                        active
                          ? 'border-primary/15 bg-secondary/60 font-semibold text-primary shadow-subtle'
                          : 'border-transparent bg-surface-muted/60 font-medium text-muted hover:border-line hover:bg-surface-muted hover:text-ink'
                      } ${focusRing}`}
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            active ? 'bg-primary' : 'bg-line group-hover:bg-muted/50'
                          }`}
                          aria-hidden="true"
                        />
                        {item.label}
                      </span>
                      <span
                        className={`material-symbols-outlined text-[20px] ${
                          active ? 'text-primary' : 'text-muted/60 group-hover:text-muted'
                        }`}
                        aria-hidden="true"
                      >
                        arrow_forward
                      </span>
                    </Link>
                  </li>
                );
              })}
              <li className="mt-5 border-t border-line pt-5">
                {authStatus === 'authenticated' ? (
                  <div className="grid gap-2">
                    {user && (
                      <div className="mb-2 flex min-h-16 items-center gap-3 rounded-xl border border-line bg-surface-muted/60 px-4 py-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                          {`${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-body-md font-semibold text-ink">
                            {t.auth.greeting} {user.firstName}
                          </p>
                          <p className="truncate text-body-sm text-muted">{user.email}</p>
                        </div>
                      </div>
                    )}
                    <Link
                      href="/dashboard/invitations/new"
                      onClick={() => onMenuChange(false)}
                      className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-body-md font-medium text-ink transition-colors hover:bg-ink/[0.03] ${focusRing}`}
                    >
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                        dashboard
                      </span>
                      {t.auth.goToDashboard}
                    </Link>
                    <button
                      type="button"
                      onClick={onLogout}
                      disabled={loggingOut}
                      className={`mt-1 min-h-12 rounded-xl px-4 text-body-md text-error transition-colors hover:bg-error/5 disabled:opacity-50 ${focusRing}`}
                    >
                      {loggingOut ? t.auth.loggingOut : t.auth.logout}
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onMenuChange(false);
                        onAuthOpen('login');
                      }}
                      className={`min-h-12 rounded-xl border border-line bg-surface px-4 text-body-md font-medium text-ink transition-[background-color,border-color] hover:border-primary/25 hover:bg-secondary/50 ${focusRing}`}
                    >
                      {t.auth.login}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onMenuChange(false);
                        onAuthOpen('register');
                      }}
                      className={`min-h-12 rounded-xl border border-line bg-surface px-4 text-body-md font-semibold text-ink transition-[background-color,border-color] hover:border-primary/25 hover:bg-secondary/50 ${focusRing}`}
                    >
                      {t.auth.signup}
                    </button>
                    {authStatus === 'error' && (
                      <button
                        type="button"
                        onClick={onAuthRetry}
                        className={`min-h-12 rounded-xl border border-line bg-surface-muted px-4 text-body-md font-medium text-ink ${focusRing}`}
                      >
                        {t.auth.retryAccount}
                      </button>
                    )}
                  </div>
                )}
              </li>
            </ul>
          </nav>
        </>
      )}

      {authError && authStatus === 'authenticated' && (
        <div
          role="alert"
          className="fixed end-4 top-20 z-50 mt-2 rounded-xl border border-line bg-surface px-4 py-3 text-body-sm text-error shadow-subtle"
        >
          {authError}
        </div>
      )}
    </header>
  );
}

/** Fixed top header with lightweight scroll and section state. */
export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { locale } = useLocale();
  const showToast = useToast();
  const t = getDictionary(locale);
  const [scrolled, setScrolled] = useState(false);
  const [activeKey, setActiveKey] = useState<LandingNavLinkDef['key'] | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [loggingOut, setLoggingOut] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const loadAuth = useCallback(async () => {
    setAuthStatus('loading');
    setAuthError(null);
    try {
      const current = await getCurrentUser();
      setUser(current);
      setAuthStatus(current ? 'authenticated' : 'anonymous');
    } catch {
      setUser(null);
      setAuthStatus('error');
      setAuthError(t.auth.accountCheckFailed);
    }
  }, [t]);

  useEffect(() => {
    void loadAuth();
  }, [loadAuth]);

  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 8);
        ticking = false;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    const targets = NAV_LINK_DEFS.map((item) => {
      const id = item.href.split('#')[1];
      const element = id ? document.getElementById(id) : null;
      return element ? { ...item, element } : null;
    }).filter((item): item is LandingNavLinkDef & { element: HTMLElement } => Boolean(item));
    if (targets.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (!visible?.target.id) return;
        const match = targets.find((item) => item.element === visible.target);
        if (match) setActiveKey(match.key);
      },
      { rootMargin: '-30% 0px -55% 0px', threshold: [0.15, 0.35, 0.6] }
    );
    targets.forEach((item) => observer.observe(item.element));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
    setActiveKey(pathname === '/' && window.location.hash === '#pricing' ? 'enterprise' : null);
  }, [pathname]);

  useEffect(() => {
    if (pathname !== '/') return;
    const requestedMode = new URLSearchParams(window.location.search).get('auth');
    if (requestedMode === 'login' || requestedMode === 'register') {
      setAuthMode(requestedMode);
    }
  }, [pathname]);

  useEffect(() => {
    const openSavedPromptRegistration = () => {
      setScrolled(window.scrollY > 8);
      setMenuOpen(false);
      setAuthNotice(t.auth.promptSavedNotice);
      setAuthMode('register');
    };
    window.addEventListener(PENDING_PROMPT_AUTH_EVENT, openSavedPromptRegistration);
    return () => window.removeEventListener(PENDING_PROMPT_AUTH_EVENT, openSavedPromptRegistration);
  }, [t.auth.promptSavedNotice]);

  useEffect(() => {
    const onOpenAuthModal = (event: Event) => {
      const mode = (event as CustomEvent<unknown>).detail;
      if (mode !== 'login' && mode !== 'register') return;
      if (authStatus === 'authenticated' && user) {
        router.push(getRoleHomePath(user.role));
        return;
      }
      setAuthNotice(null);
      setAuthMode(mode);
    };
    window.addEventListener(AUTH_MODAL_OPEN_EVENT, onOpenAuthModal);
    return () => window.removeEventListener(AUTH_MODAL_OPEN_EVENT, onOpenAuthModal);
  }, [authStatus, user, router]);

  function openAuth(mode: AuthMode) {
    if (authStatus === 'authenticated' && user) {
      router.push(getRoleHomePath(user.role));
      return;
    }
    setAuthNotice(null);
    setAuthMode(mode);
  }

  async function handleLogout() {
    setLoggingOut(true);
    setAuthError(null);
    try {
      await withAuthFeedback(
        () => logout(),
        AUTH_SUCCESS_MESSAGES.logout,
        t.auth.logoutFailed,
        showToast
      );
      setUser(null);
      setMenuOpen(false);
      setAuthStatus('anonymous');
      router.replace('/');
      router.refresh();
    } catch {
      setAuthError(t.auth.logoutFailed);
    } finally {
      setLoggingOut(false);
    }
  }

  function handleAuthSuccess(authenticatedUser: AuthUser) {
    setUser(authenticatedUser);
    setAuthStatus('authenticated');
    setAuthError(null);
    setAuthMode(null);
    setAuthNotice(null);
    setMenuOpen(false);
    // Bind any anonymously saved prompt to this account so a later account
    // switch discards it instead of applying it.
    adoptPendingInvitationPrompt(authenticatedUser.id);
    router.replace(
      getPostAuthRedirectTarget({
        role: authenticatedUser.role,
        search: window.location.search,
        fallback: readPendingInvitationPrompt()
          ? PENDING_PROMPT_TARGET
          : '/dashboard/invitations/new',
      })
    );
  }

  return (
    <>
      <HeaderView
        locale={locale}
        user={user}
        authStatus={authStatus}
        authError={authError}
        loggingOut={loggingOut}
        menuOpen={menuOpen}
        scrolled={scrolled}
        activeKey={activeKey}
        onMenuChange={setMenuOpen}
        onAuthOpen={openAuth}
        onAuthRetry={() => void loadAuth()}
        onLogout={() => void handleLogout()}
      />
      {authMode && (
        <AuthModal
          mode={authMode}
          locale={locale}
          notice={authNotice}
          onModeChange={setAuthMode}
          onClose={() => {
            setAuthMode(null);
            setAuthNotice(null);
            if (pathname === '/' && new URLSearchParams(window.location.search).has('auth')) {
              router.replace('/');
            }
          }}
          onSuccess={handleAuthSuccess}
        />
      )}
    </>
  );
}
