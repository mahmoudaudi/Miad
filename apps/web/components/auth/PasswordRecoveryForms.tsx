'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { AuthApiError, requestPasswordReset, resetPassword } from '@/lib/auth';

const inputClass = 'miad-input mt-2';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(null); setMessage(null);
    try { await requestPasswordReset(email.trim()); setMessage('If an account matches that email, reset instructions will be sent shortly.'); }
    catch (caught) { setError(caught instanceof AuthApiError ? caught.message : 'We could not start password recovery.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-5"><label className="block text-label-md text-ink">Email<input required type="email" autoComplete="email" className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} /></label>{message && <p role="status" className="text-body-sm text-success">{message}</p>}{error && <p role="alert" className="text-body-sm text-error">{error}</p>}<button disabled={busy} className="miad-button miad-button--primary w-full">{busy ? 'Sending…' : 'Send reset instructions'}</button><Link href="/login" className="block text-center text-body-sm text-muted hover:text-ink">Back to login</Link></form>;
}

export function ResetPasswordForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(params.get('token') ?? '');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(null); setMessage(null);
    try { await resetPassword({ token: token.trim(), password }); setMessage('Your password was reset. You can now log in.'); }
    catch (caught) { setError(caught instanceof AuthApiError ? caught.message : 'We could not reset your password.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-5"><label className="block text-label-md text-ink">Reset token<input required className={inputClass} value={token} onChange={(event) => setToken(event.target.value)} /></label><label className="block text-label-md text-ink">New password<input required minLength={10} type="password" autoComplete="new-password" className={inputClass} value={password} onChange={(event) => setPassword(event.target.value)} /></label>{message && <p role="status" className="text-body-sm text-success">{message} <Link href="/login" className="underline">Log in</Link></p>}{error && <p role="alert" className="text-body-sm text-error">{error}</p>}<button disabled={busy} className="miad-button miad-button--primary w-full">{busy ? 'Resetting…' : 'Reset password'}</button></form>;
}
