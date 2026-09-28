'use client';

import { usePathname, useRouter } from 'next/navigation';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { ADMIN_LOGIN_PATH, isAdminRole } from '@/lib/admin-auth';
import { AuthUser, getCurrentUser, logout } from '@/lib/auth';
import { AdminHeader } from './AdminHeader';
import { AdminSidebar, type AdminSection } from './AdminSidebar';
import styles from './admin.module.css';

const AdminSessionContext = createContext<AuthUser | null>(null);

export function useAdminSession(): AuthUser {
  const user = useContext(AdminSessionContext);
  if (!user) throw new Error('useAdminSession must be used inside AdminShell.');
  return user;
}

/**
 * Guard + frame for every inner admin page. Non-admin sessions are bounced
 * to /admin/login; the API remains authoritative via @Roles('admin').
 */
function sectionForPath(pathname: string): AdminSection {
  if (pathname === '/admin/users' || pathname.startsWith('/admin/users/')) return 'users';
  if (pathname === '/admin/invitations' || pathname.startsWith('/admin/invitations/')) {
    return 'invitations';
  }
  if (pathname === '/admin/community' || pathname.startsWith('/admin/community/')) {
    return 'community';
  }
  if (pathname === '/admin/ai-engine' || pathname.startsWith('/admin/ai-engine/')) {
    return 'ai-engine';
  }
  if (pathname === '/admin/billing' || pathname.startsWith('/admin/billing/')) return 'billing';
  if (pathname === '/admin/analytics' || pathname.startsWith('/admin/analytics/')) {
    return 'analytics';
  }
  return 'overview';
}

export function AdminShell({
  children,
  section,
}: {
  children: React.ReactNode;
  section?: AdminSection;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const activeSection = section ?? sectionForPath(pathname);
  const [user, setUser] = useState<AuthUser | null>(null);

  // The session is validated against /auth/me on every mount. No cached
  // identity is ever rendered: a cached Account A must never appear while
  // Account B holds the session.
  useEffect(() => {
    let cancelled = false;
    const checkSession = async () => {
      try {
        const current = await getCurrentUser();
        if (cancelled) return;
        if (!current || !isAdminRole(current.role)) {
          router.replace(ADMIN_LOGIN_PATH);
          return;
        }
        setUser(current);
      } catch {
        if (!cancelled) {
          router.replace(ADMIN_LOGIN_PATH);
        }
      }
    };
    checkSession();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onLogout() {
    try {
      await logout();
    } catch {
      // Session already unusable; still leave the admin area.
    }
    router.replace(ADMIN_LOGIN_PATH);
  }

  if (!user) {
    return (
      <div className={styles.shellRoot} aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading admin portal…</span>
        <div className="flex min-h-screen bg-[#fbf8ff]">
          <div className="hidden w-64 shrink-0 animate-pulse bg-white lg:block" />
          <div className="flex-1 p-8">
            <div className="mx-auto h-32 max-w-[1440px] animate-pulse rounded-xl bg-white shadow-sm" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <AdminSessionContext.Provider value={user}>
      <div className={`min-h-screen bg-[#fbf8ff] text-[#1a1b22] ${styles.shellRoot}`}>
        <AdminSidebar user={user} section={activeSection} onLogout={onLogout} />
        <div className="flex min-h-screen flex-col lg:pl-64">
          <AdminHeader section={activeSection} />
          <main className="w-full flex-1 pt-14">{children}</main>
        </div>
      </div>
    </AdminSessionContext.Provider>
  );
}
