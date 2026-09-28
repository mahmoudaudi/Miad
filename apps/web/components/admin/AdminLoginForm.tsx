'use client';

import { useRouter } from 'next/navigation';
import React, { useEffect, useId, useState } from 'react';
import { ADMIN_HOME_PATH, AdminAccessDeniedError, isAdminRole, signInAsAdmin } from '@/lib/admin-auth';
import { getCurrentUser } from '@/lib/auth';
import { safeAuthErrorMessage } from '@/lib/auth-feedback';
import { useToast } from '@/components/ui/ToastProvider';
import { isValidEmail } from '@/lib/validators';

function EmailIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function EyeIcon({ off }: { off: boolean }) {
  if (off) {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
        />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

/**
 * Admin sign-in form. Uses the shared auth API, then enforces the admin role
 * client-side (the API remains authoritative via @Roles('admin')). A signed-in
 * non-admin session is logged out before showing the access-only error so a
 * user cookie can never linger into the admin area.
 */
export function AdminLoginForm() {
  const router = useRouter();
  const showToast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const formId = useId();

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then((user) => {
        if (!cancelled && user && isAdminRole(user.role)) {
          router.replace(ADMIN_HOME_PATH);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!isValidEmail(email)) {
      const message = 'Enter a valid email address.';
      setError(message);
      showToast(message, 'error');
      return;
    }
    if (!password) {
      const message = 'Enter your password.';
      setError(message);
      showToast(message, 'error');
      return;
    }
    setBusy(true);
    try {
      await signInAsAdmin({ email: email.trim(), password });
      showToast('Signed in. Welcome back.', 'success');
      router.replace(ADMIN_HOME_PATH);
    } catch (err) {
      const message =
        err instanceof AdminAccessDeniedError
          ? err.message
          : safeAuthErrorMessage(err, 'Sign in failed. Check your credentials and try again.');
      setError(message);
      showToast(message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <div aria-busy="true" aria-live="polite" className="space-y-5">
        <span className="sr-only">Checking your session…</span>
        <div className="h-12 animate-pulse rounded-lg bg-zinc-200/70" />
        <div className="h-12 animate-pulse rounded-lg bg-zinc-200/70" />
        <div className="h-12 animate-pulse rounded-lg bg-[#7d1128]/20" />
      </div>
    );
  }

  const inputCls =
    'block w-full py-3 text-sm text-zinc-900 bg-white border border-zinc-200 rounded-lg placeholder-zinc-400 focus:outline-none focus:border-[#7d1128] focus:ring-2 focus:ring-[#7d1128]/15 transition-all duration-150 disabled:opacity-60';

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate aria-busy={busy}>
      <div>
        <label
          htmlFor={`${formId}-email`}
          className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-700"
        >
          Email Address
        </label>
        <div className="relative rounded-lg shadow-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
            <EmailIcon />
          </div>
          <input
            id={`${formId}-email`}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            disabled={busy}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@miad.sa"
            className={`${inputCls} pl-10 pr-3.5`}
          />
        </div>
      </div>

      <div>
        <label
          htmlFor={`${formId}-password`}
          className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-700"
        >
          Password
        </label>
        <div className="relative rounded-lg shadow-sm">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-400">
            <LockIcon />
          </div>
          <input
            id={`${formId}-password`}
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            disabled={busy}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            className={`${inputCls} pl-10 pr-10`}
          />
          <button
            type="button"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 transition hover:text-zinc-600 focus:outline-none"
          >
            <EyeIcon off={showPassword} />
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm font-medium text-[#8e1631]">
          {error}
        </p>
      ) : null}

      <div className="pt-3">
        <button
          type="submit"
          disabled={busy}
          className="group inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#7d1128] px-5 py-3 text-sm font-semibold tracking-wide text-white shadow-[0_4px_14px_0_rgba(125,17,40,0.3)] transition duration-200 ease-in-out hover:bg-[#670e21] active:bg-[#520b1a] focus:outline-none focus:ring-2 focus:ring-[#7d1128] focus:ring-offset-2 disabled:opacity-70"
        >
          <span className="whitespace-nowrap">{busy ? 'Signing in…' : 'Sign In'}</span>
          <svg
            className="h-4 w-4 flex-none transition-transform duration-150 group-hover:translate-x-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              d="M14 5l7 7m0 0l-7 7m7-7H3"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
            />
          </svg>
        </button>
      </div>
    </form>
  );
}
