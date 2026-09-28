import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { AuthUser } from '@/lib/auth';
import { initialsOf } from '@/lib/admin';
import styles from './admin.module.css';

export type AdminSection =
  | 'overview'
  | 'users'
  | 'invitations'
  | 'community'
  | 'ai-engine'
  | 'billing'
  | 'analytics';

type NavItem = {
  section: AdminSection;
  label: string;
  icon: string;
  href: string;
};

/** Only shipped sections are listed — new pages add their nav item on arrival. */
const CORE_NAV: NavItem[] = [
  { section: 'overview', label: 'Overview', icon: 'dashboard', href: '/admin' },
  { section: 'users', label: 'Users', icon: 'group', href: '/admin/users' },
  {
    section: 'invitations',
    label: 'Invitations',
    icon: 'mark_email_read',
    href: '/admin/invitations',
  },
  { section: 'community', label: 'Community', icon: 'forum', href: '/admin/community' },
  {
    section: 'ai-engine',
    label: 'AI Engine',
    icon: 'auto_awesome',
    href: '/admin/ai-engine',
  },
  { section: 'billing', label: 'Billing', icon: 'credit_card', href: '/admin/billing' },
  { section: 'analytics', label: 'Analytics', icon: 'monitoring', href: '/admin/analytics' },
];

function NavList({ items, active }: { items: NavItem[]; active: AdminSection }) {
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const isActive = item.section === active;
        return (
          <Link
            key={item.section}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 ${
              isActive
                ? 'bg-gradient-to-r from-[#8e1631] to-[#7d1128] font-medium text-white shadow-[0_4px_14px_0_rgba(125,17,40,0.35)]'
                : 'text-[#47464b] transition-colors hover:bg-[#f4f2fd] hover:text-[#1a1b22]'
            }`}
          >
            <span
              className={`material-symbols-outlined text-[18px] ${isActive ? styles.symbolFilled : ''}`}
              aria-hidden="true"
            >
              {item.icon}
            </span>
            <span className="flex-1 text-[13px] font-medium leading-[18px] tracking-[-0.01em]">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#47464b]/70 ${styles.mono}`}
    >
      {children}
    </div>
  );
}

/**
 * Fixed admin sidebar. The admin's name/role come from the live session —
 * the SaaS has no super-admin tier, so the role reads simply "Admin".
 */
export function AdminSidebar({
  user,
  section,
  onLogout,
}: {
  user: AuthUser;
  section: AdminSection;
  onLogout: () => void;
}) {
  const name = `${user.firstName} ${user.lastName}`.trim() || user.email;
  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-screen w-64 select-none flex-col border-r border-[#e3e1ec] bg-white shadow-sm lg:flex">
      <div className="flex shrink-0 items-center justify-between border-b border-[#e3e1ec] px-3 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <Image
            alt="Miad"
            src="/miad-logo.png"
            width={120}
            height={80}
            className="h-8 w-auto object-contain"
          />
        </div>
        <span
          className={`rounded bg-[#eeedf7] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#47464b] ${styles.mono}`}
        >
          Admin
        </span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        <div className="space-y-1">
          <SectionLabel>Core Platform</SectionLabel>
          <NavList items={CORE_NAV} active={section} />
        </div>
      </div>

      <div className="shrink-0 border-t border-[#e3e1ec] bg-white p-2">
        <div className="flex items-center justify-between rounded-lg p-1.5 transition-colors hover:bg-[#f4f2fd]">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eeedf7] text-[11px] font-semibold text-[#1a1b22] ring-1 ring-[#c8c5cb]"
            >
              {initialsOf(name)}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-medium leading-tight text-[#1a1b22]">
                {name}
              </span>
              <span className="truncate text-[11px] text-[#47464b]">Admin</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            title="Sign out"
            className="rounded-md p-1.5 text-[#47464b] transition-colors hover:bg-[#e8e7f1] hover:text-[#1a1b22]"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
              logout
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
