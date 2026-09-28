import { AdminShell } from '@/components/admin/AdminShell';

/**
 * Inner admin route group: every page here renders inside the AdminShell
 * (sidebar + header + session guard). The URL is unaffected (/admin, ...).
 */
export default function AdminShellLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
