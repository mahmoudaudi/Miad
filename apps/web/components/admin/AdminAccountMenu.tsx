'use client';

import type { AuthUser } from '@/lib/auth';
import Link from 'next/link';
import { UnreadNotificationBadge } from '@/components/notifications/UnreadNotificationBadge';
import { ThemeToggle } from '@/components/landing/ThemeToggle';
import { Popover } from '@/components/ui/Popover';
import { initialsOf } from '@/lib/admin';

export function AdminAccountMenu({
  user,
  onLogout,
  mobile = false,
}: {
  user: AuthUser;
  onLogout: () => void;
  mobile?: boolean;
}) {
  const name = `${user.firstName} ${user.lastName}`.trim() || user.email;

  return (
    <Popover
      label={`Account: ${name}`}
      side={mobile ? 'bottom' : 'top'}
      align={mobile ? 'end' : 'start'}
      className={`miad-account-menu ${mobile ? 'lg:hidden' : ''}`}
      triggerClassName={
        mobile
          ? '!min-h-10 !w-10 !px-0'
          : 'w-full !min-h-11 !justify-start !gap-2.5 !rounded-lg !px-2 hover:!bg-surface-muted'
      }
      trigger={
        <>
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-ink ring-1 ring-line">
            {initialsOf(name)}
          </span>
          {!mobile && (
            <span className="min-w-0 flex-1 text-start">
              <span className="block truncate text-xs font-medium text-ink">{name}</span>
              <span className="block truncate text-[11px] text-muted">Admin</span>
            </span>
          )}
          {!mobile && (
            <span className="material-symbols-outlined text-[16px] text-muted" aria-hidden="true">
              expand_less
            </span>
          )}
        </>
      }
    >
      <p className="break-all border-b border-line px-3 py-2 text-[11px] text-muted">
        {user.email}
      </p>
      <ThemeToggle variant="menu" />
      <Link href="/admin/notifications" className="miad-menu-item flex items-center gap-2 text-xs text-ink">
        <span className="material-symbols-outlined text-[16px] text-muted" aria-hidden="true">notifications</span>
        Notifications
        <UnreadNotificationBadge />
      </Link>
      <button type="button" onClick={onLogout} className="miad-menu-item text-xs text-ink">
        <span className="material-symbols-outlined text-[16px] text-muted" aria-hidden="true">
          logout
        </span>
        Sign out
      </button>
    </Popover>
  );
}
