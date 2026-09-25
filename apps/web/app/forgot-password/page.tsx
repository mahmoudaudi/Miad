import type { Metadata } from 'next';
import { ForgotPasswordForm } from '@/components/auth/PasswordRecoveryForms';

export const metadata: Metadata = { title: 'Forgot password — Miad' };

export default function ForgotPasswordPage() {
  return <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12"><section className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-subtle sm:p-9"><p className="text-label-sm uppercase tracking-[0.16em] text-accent">Account recovery</p><h1 className="mt-3 font-display text-headline-md text-ink">Forgot your password?</h1><p className="mt-3 text-body-md text-muted">Enter your email and we will send a secure reset link.</p><div className="mt-8"><ForgotPasswordForm /></div></section></main>;
}
