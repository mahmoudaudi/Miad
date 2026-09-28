import type { Metadata } from 'next';
import { AdminBrandPane } from '@/components/admin/AdminBrandPane';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';

export const metadata: Metadata = {
  title: 'Sign In — Miad Admin Portal',
  description: 'Sign in to your admin account to continue.',
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row">
      <AdminBrandPane />
      <main className="flex flex-1 flex-col justify-between bg-[#faf8f7] p-6 sm:bg-white sm:p-12 lg:p-16 xl:p-24">
        <div className="mx-auto my-auto w-full max-w-[420px] py-10 sm:py-0">
          <div className="mb-8">
            <h1 className="mb-2 text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
              Welcome back
            </h1>
            <p className="text-sm font-normal text-zinc-500">
              Sign in to your admin account to continue
            </p>
          </div>
          <AdminLoginForm />
        </div>
      </main>
    </div>
  );
}
