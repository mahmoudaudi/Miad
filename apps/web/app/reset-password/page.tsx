import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ResetPasswordForm } from '@/components/auth/PasswordRecoveryForms';

export const metadata: Metadata = { title: 'Reset password — Miad' };

export default function ResetPasswordPage() {
  return <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12"><section className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-subtle sm:p-9"><p className="text-label-sm uppercase tracking-[0.16em] text-accent">Account recovery</p><h1 className="mt-3 font-display text-headline-md text-ink">Set a new password</h1><div className="mt-8"><Suspense fallback={<div className="h-56 animate-pulse rounded-xl bg-background" />}><ResetPasswordForm /></Suspense></div></section></main>;
}
