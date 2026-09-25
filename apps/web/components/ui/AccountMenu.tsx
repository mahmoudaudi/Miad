'use client';
import React from 'react';
import Link from 'next/link';
import type { AuthUser } from '@/lib/auth';
import { Popover } from './Popover';

export function AccountMenu({
  user,
  loggingOut,
  onLogout,
  compact = false,
  side = 'bottom',
}: {
  user: AuthUser;
  loggingOut: boolean;
  onLogout: () => void;
  compact?: boolean;
  side?: 'top' | 'bottom';
}) {
  const name = `${user.firstName} ${user.lastName}`.trim() || 'Your account';
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase() || 'M';
  return (
    <Popover
      label={`Account: ${name}`}
      side={side}
      align={side === 'top' ? 'start' : 'end'}
      triggerClassName="w-full !justify-start !px-1.5"
      trigger={
        <>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
            {initials}
          </span>
          {!compact && <span className="min-w-0 flex-1 truncate text-start">{name}</span>}
          {!compact && (
            <span aria-hidden="true" className="material-symbols-outlined text-lg text-muted">
              expand_more
            </span>
          )}
        </>
      }
    >
      <div className="mb-2 border-b border-line px-3 pb-3 pt-1">
        <p className="break-words text-sm font-semibold">{name}</p>
        <p className="mt-1 break-all text-xs text-muted">{user.email}</p>
        <p className="mt-2 text-xs text-muted">Personal workspace</p>
      </div>
      <Link className="miad-menu-item" href="/dashboard/invitations/new">
        AI Studio
      </Link>
      <Link className="miad-menu-item" href="/dashboard/notifications">
        Notifications
      </Link>
      <button
        className="miad-menu-item text-error"
        type="button"
        disabled={loggingOut}
        onClick={onLogout}
      >
        {loggingOut ? 'Logging out…' : 'Log out'}
      </button>
    </Popover>
  );
}
