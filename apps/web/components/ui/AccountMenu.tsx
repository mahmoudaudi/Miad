'use client';

import Link from 'next/link';
import React from 'react';
import type { AuthUser } from '@/lib/auth';
import { Popover } from './Popover';
import { ThemeToggle } from '@/components/landing/ThemeToggle';
import { UnreadNotificationBadge } from '@/components/notifications/UnreadNotificationBadge';

export type UserProfileInput = {
  name: string;
  email: string;
  initials: string;
};

/** `workspace` mirrors the surrounding navigation; `account` is for chrome that already links those routes. */
export type AccountMenuItems = 'workspace' | 'account';

export function AccountMenu({
  user,
  profile,
  loggingOut = false,
  onLogout,
  compact = false,
  items = 'workspace',
  side = 'bottom',
  triggerClassName,
}: {
  user?: AuthUser | null;
  profile?: UserProfileInput;
  loggingOut?: boolean;
  onLogout?: () => void;
  compact?: boolean;
  items?: AccountMenuItems;
  side?: 'top' | 'bottom';
  triggerClassName?: string;
}) {
  const name =
    profile?.name ||
    (user ? `${user.firstName} ${user.lastName}`.trim() || 'Your account' : 'Your account');
  const email = profile?.email || user?.email || '';
  // The avatar carries a single letter; the full name sits beside it as text, so a
  // second letter would only crowd the circle. The fallback keeps a letter showing
  // even when the name is a placeholder.
  const monogram = (user?.firstName?.trim() || name.trim().split(' ')[0] || '').charAt(0);
  const letter = monogram.toUpperCase() || 'M';

  return (
    <Popover
      label={`Account: ${name}`}
      side={side}
      align={side === 'top' ? 'start' : 'end'}
      className={items === 'account' ? 'miad-account-menu' : ''}
      triggerClassName={triggerClassName ?? 'w-full !justify-start !px-1.5'}
      trigger={
        <>
          <span
            className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${
              items === 'account'
                ? 'size-5 bg-[#1b7a42] text-[11px]'
                : 'size-8 bg-[#9f1239] text-xs shadow-sm'
            }`}
          >
            {letter}
          </span>
          {!compact && (
            <span
              className={`min-w-0 truncate text-start ${
                items === 'account'
                  ? 'text-xs font-medium text-ink'
                  : 'flex-1 text-xs font-medium text-muted'
              }`}
            >
              {name}
            </span>
          )}
          {!compact && (
            <span
              aria-hidden="true"
              className="miad-chevron material-symbols-outlined shrink-0 text-[14px] text-muted"
            >
              expand_less
            </span>
          )}
        </>
      }
    >
      <div className="mb-1.5 border-b border-line px-3 pb-2.5 pt-2 text-start">
        <p className="break-words text-xs font-semibold text-ink">{name}</p>
        {email && <p className="mt-0.5 break-all text-[11px] text-muted">{email}</p>}
        {items === 'workspace' && (
          <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-primary">
            Personal workspace
          </p>
        )}
      </div>
      {items === 'workspace' ? (
        <>
          <Link
            className="miad-menu-item flex items-center gap-2 text-xs"
            href="/dashboard/invitations/new"
          >
            <span className="material-symbols-outlined text-[16px] text-primary">auto_awesome</span>
            AI Studio
          </Link>
          <Link
            className="miad-menu-item flex items-center gap-2 text-xs"
            href="/dashboard/invitations"
          >
            <span className="material-symbols-outlined text-[16px]">mail</span>
            My Invitations
          </Link>
        </>
      ) : null}
      <Link
        className="miad-menu-item flex items-center gap-2 text-xs"
        href="/dashboard/notifications"
      >
        <span className="material-symbols-outlined text-[16px] text-muted">notifications</span>
        Notifications
        <UnreadNotificationBadge />
      </Link>
      <ThemeToggle variant="menu" />
      {items === 'workspace' && (
        <Link className="miad-menu-item flex items-center gap-2 text-xs" href="/dashboard/billing">
          <span className="material-symbols-outlined text-[16px]">payments</span>
          Billing
        </Link>
      )}
      <div className="my-1.5 border-t border-line" />
      <div className="px-1.5 pb-0.5 pt-1">
        <button
          className="miad-menu-item flex w-full items-center gap-2 rounded-lg bg-surface-muted text-xs font-medium text-ink transition-colors hover:bg-secondary"
          type="button"
          disabled={loggingOut || !onLogout}
          onClick={onLogout}
        >
          <span className="material-symbols-outlined text-[16px] text-muted">logout</span>
          {loggingOut ? 'Logging out…' : 'Log out'}
        </button>
      </div>
    </Popover>
  );
}
