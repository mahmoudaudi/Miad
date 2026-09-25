'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccountMenu } from '@/components/ui/AccountMenu';
import { useOverlay } from '@/components/ui/useOverlay';
import { AuthUser, getCurrentUser, logout } from '@/lib/auth';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { useLocale } from '@/lib/i18n/LocaleProvider';
import {
  PENDING_PROMPT_AUTH_EVENT,
  PENDING_PROMPT_TARGET,
  readPendingInvitationPrompt,
} from '@/lib/pending-invitation-prompt';
import type { AuthMode } from './AuthModal';

// The login/register forms only load when the visitor opens the auth modal,
// keeping them out of the initial landing bundle.
const AuthModal = dynamic(
  () => import('./AuthModal').then((module) => ({ default: module.AuthModal })),
  { ssr: false }
);

export type LandingNavLinkDef = { key: 'howItWorks' | 'templates' | 'pricing'; href: string };

/** Navbar destinations — labels resolve from the dictionary (see NAV_LINKS). */
export const NAV_LINK_DEFS: LandingNavLinkDef[] = [
  { key: 'howItWorks', href: '/#how-it-works' },
  { key: 'templates', href: '/#templates' },
  { key: 'pricing', href: '/#pricing' },
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

const headerBase =
  'fixed inset-x-0 top-0 z-50 h-20 border-b px-3 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-200 sm:px-5 md:px-gutter';

const navLinkBase =
  'group relative inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-label-md transition-colors hover:bg-ink/[0.035] hover:text-ink';

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
    return (
      <div
        aria-label={t.auth.checkingAccount}
        className="hidden h-11 w-40 animate-pulse rounded-xl bg-ink/5 lg:block"
      />
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
      <>
        <Link
          href="/dashboard/invitations/new"
          className={`hidden min-h-11 items-center whitespace-nowrap rounded-xl px-4 text-label-md text-muted transition-colors hover:bg-ink/[0.04] hover:text-ink lg:inline-flex ${focusRing}`}
        >
          {t.nav.dashboard}
        </Link>
        <Link
          href="/dashboard/invitations/new"
          className={`hidden min-h-11 items-center gap-2 whitespace-nowrap rounded-xl bg-primary px-5 text-label-md text-white shadow-[0_6px_18px_rgba(122,38,58,0.18)] transition-[background-color,box-shadow] hover:bg-primary-hover hover:shadow-[0_8px_22px_rgba(122,38,58,0.22)] lg:inline-flex ${focusRing}`}
        >
          {t.auth.createInvitation}
          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
            arrow_forward
          </span>
        </Link>
        <div className="hidden lg:block">
          <AccountMenu user={user} loggingOut={loggingOut} onLogout={onLogout} compact />
        </div>
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => onAuthOpen('login')}
        className={`hidden min-h-11 items-center justify-center whitespace-nowrap rounded-xl border border-transparent px-4 text-label-md text-muted transition-colors hover:border-line hover:bg-surface/80 hover:text-ink lg:inline-flex ${focusRing}`}
      >
        {t.auth.login}
      </button>
      <button
        type="button"
        onClick={() => onAuthOpen('register')}
        className={`hidden min-h-11 items-center gap-2 whitespace-nowrap rounded-xl bg-primary px-5 text-label-md text-white shadow-[0_6px_18px_rgba(122,38,58,0.18)] transition-[background-color,box-shadow] hover:bg-primary-hover hover:shadow-[0_8px_22px_rgba(122,38,58,0.22)] lg:inline-flex ${focusRing}`}
      >
        {t.auth.createInvitation}
        <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
          arrow_forward
        </span>
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
    <header
      dir="ltr"
      className={`${headerBase} ${
        scrolled || menuOpen
          ? 'border-line bg-background/95 shadow-[0_12px_32px_rgba(23,23,23,0.07)] backdrop-blur-xl'
          : 'border-transparent bg-background/80 backdrop-blur-xl'
      }`}
    >
      <div className="mx-auto grid h-20 max-w-[1240px] grid-cols-[auto_1fr_auto] items-center gap-3 lg:gap-8">
        <Link
          href="/"
          aria-label={t.nav.home}
          className={`flex min-h-11 shrink-0 items-center rounded-lg p-1.5 ${focusRing}`}
        >
          <Image
            alt={t.nav.logo}
            className="h-14 w-28 shrink-0 object-contain sm:h-16 sm:w-32"
            src={LOGO_URL}
            width={150}
            height={100}
            priority
          />
        </Link>

        <nav aria-label={t.nav.landing} className="hidden items-center gap-1 lg:flex">
          {navLinks.map((item) => {
            const active = activeKey === item.key;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`${navLinkBase} ${
                  active ? 'bg-ink/[0.04] font-semibold text-ink' : 'font-medium text-muted'
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

        <div className="flex min-w-0 items-center justify-end gap-2">
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
            className={`flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface/80 text-ink transition-colors hover:bg-ink/[0.04] lg:hidden ${focusRing}`}
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
            className="fixed inset-x-0 top-20 z-0 h-[calc(100dvh-5rem)] bg-ink/30 backdrop-blur-[2px] lg:hidden"
          />
          <nav
            ref={mobileRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            id="landing-mobile-menu"
            aria-label={t.nav.mobile}
            className="absolute inset-x-3 top-[calc(100%+0.5rem)] z-10 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-4 text-start shadow-lift sm:inset-x-5 sm:p-5 lg:hidden"
          >
            <div className="mb-4 flex items-center justify-between border-b border-line px-1 pb-4">
              <div>
                <p className="text-title text-ink">{t.nav.menuTitle}</p>
                <p className="mt-0.5 text-body-sm text-muted">{t.nav.menuDescription}</p>
              </div>
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
                          ? 'border-line bg-secondary/[0.55] font-semibold text-ink shadow-subtle'
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
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
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
                      className={`flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-body-md font-semibold text-white shadow-[0_6px_18px_rgba(122,38,58,0.16)] ${focusRing}`}
                    >
                      {t.auth.createInvitation}
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                        arrow_forward
                      </span>
                    </Link>
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
                        onAuthOpen('register');
                      }}
                      className={`flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-body-md font-semibold text-white shadow-[0_6px_18px_rgba(122,38,58,0.16)] ${focusRing}`}
                    >
                      {t.auth.createInvitation}
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                        arrow_forward
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onMenuChange(false);
                        onAuthOpen('login');
                      }}
                      className={`min-h-12 rounded-xl border border-line bg-surface px-4 text-body-md font-medium text-ink transition-colors hover:bg-ink/[0.03] ${focusRing}`}
                    >
                      {t.auth.login}
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

  function openAuth(mode: AuthMode) {
    setAuthNotice(null);
    setAuthMode(mode);
  }

  async function handleLogout() {
    setLoggingOut(true);
    setAuthError(null);
    try {
      await logout();
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
    router.push(
      readPendingInvitationPrompt() ? PENDING_PROMPT_TARGET : '/dashboard/invitations/new'
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
          }}
          onSuccess={handleAuthSuccess}
        />
      )}
    </>
  );
}
