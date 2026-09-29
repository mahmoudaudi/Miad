import type { Metadata } from 'next';
import styles from '@/components/admin/admin.module.css';

/* eslint-disable @next/next/no-page-custom-font -- App Router has no _document; hoisted <link> is the documented approach */

export const metadata: Metadata = {
  title: 'Miad Admin Portal',
  description: 'Admin access only. Sign in to continue.',
  robots: { index: false, follow: false },
};

/**
 * Admin route-group shell. Intentionally separate from the user
 * DashboardShell: own fonts (Plus Jakarta Sans + JetBrains Mono) and own
 * typography and application shell, scoped so the user app is untouched.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      {/* Overview shell: Geist + Material Symbols (isolated to /admin routes). */}
      <link
        href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&display=swap"
        rel="stylesheet"
      />
      <div className={`miad-admin-theme min-h-screen bg-white text-zinc-900 ${styles.root}`}>
        {children}
      </div>
    </>
  );
}
