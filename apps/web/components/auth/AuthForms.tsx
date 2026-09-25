'use client';

import React, { useId, useState } from 'react';
import { LookAwayLogin } from './LookAwayLogin';
import { AuthApiError, AuthUser, login, register, startGoogleSignIn } from '@/lib/auth';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/locales';
import { isValidEmail, validateRegister } from '@/lib/validators';

const inputCls = 'miad-input';
const submitCls = 'miad-button miad-button--primary w-full';

const googleButtonCls =
  'w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-label-md font-medium text-ink shadow-sm transition-all hover:border-muted/50 hover:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30';

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

function AuthDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      <span className="text-label-sm text-muted">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

function GoogleAuthButton({ label }: { label: string }) {
  return (
    <button type="button" className={googleButtonCls} onClick={startGoogleSignIn}>
      <span className="flex items-center justify-center gap-3">
        <GoogleIcon />
        <span>{label}</span>
      </span>
    </button>
  );
}

/** Shared login form — used by the modal and the /login page. */
export function LoginForm({
  locale,
  onSuccess,
  onSwitch,
}: {
  locale: Locale;
  onSuccess: (user: AuthUser) => void;
  onSwitch: () => void;
}) {
  const t = getDictionary(locale).auth;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const formId = useId();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!isValidEmail(email)) return setError(t.validation.validEmail);
    if (!password) return setError(t.validation.passwordRequired);
    setBusy(true);
    try {
      const user = await login({ email: email.trim(), password });
      onSuccess(user);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : t.validation.loginFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate aria-busy={busy}>
      <LookAwayLogin passwordFocused={passwordFocused} />
      <GoogleAuthButton
        label={t.continueWithGoogle}
      />
      <AuthDivider label={t.orContinueWithEmail} />
      <label htmlFor={`${formId}-email`} className="text-label-md text-ink">
        {t.emailLabel}
      </label>
      <input
        id={`${formId}-email`}
        aria-describedby={error ? `${formId}-error` : undefined}
        aria-label={t.emailLabel}
        className={inputCls}
        placeholder={t.emailPlaceholder}
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <label htmlFor={`${formId}-password`} className="text-label-md text-ink">
        {t.passwordLabel}
      </label>
      <input
        id={`${formId}-password`}
        aria-describedby={error ? `${formId}-error` : undefined}
        aria-label={t.passwordLabel}
        className={inputCls}
        placeholder={t.passwordPlaceholder}
        type="password"
        onFocus={() => setPasswordFocused(true)}
        onBlur={() => setPasswordFocused(false)}
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error && (
        <p
          id={`${formId}-error`}
          role="alert"
          className="rounded-xl bg-error/5 p-3 text-body-sm text-error"
        >
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={submitCls}>
        {busy ? t.loggingIn : t.login}
      </button>
      <a href="/forgot-password" className="text-center text-body-sm text-muted hover:text-ink">
        Forgot your password?
      </a>
      <p className="text-center text-body-sm text-muted">
        {t.noAccountYet}{' '}
        <button type="button" onClick={onSwitch} className="text-ink font-medium hover:text-accent">
          {t.createOne}
        </button>
      </p>
    </form>
  );
}

/** Shared registration form — used by the modal and the /register page. */
export function RegisterForm({
  locale,
  onSuccess,
  onSwitch,
}: {
  locale: Locale;
  onSuccess: (user: AuthUser) => void;
  onSwitch: () => void;
}) {
  const t = getDictionary(locale).auth;
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const formId = useId();

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const problems = validateRegister(form, locale);
    const first = problems.firstName ?? problems.lastName ?? problems.email ?? problems.password;
    if (first) return setError(first);
    setBusy(true);
    try {
      const user = await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      onSuccess(user);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : t.validation.registerFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate aria-busy={busy}>
      <LookAwayLogin passwordFocused={passwordFocused} />
      <GoogleAuthButton
        label={t.signupWithGoogle}
      />
      <AuthDivider label={t.orContinueWithEmail} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-label-md text-ink">
          {t.firstNameLabel}
          <input
            aria-label={t.firstNameLabel}
            className={inputCls}
            placeholder={t.firstNamePlaceholder}
            autoComplete="given-name"
            value={form.firstName}
            onChange={set('firstName')}
          />
        </label>
        <label className="text-label-md text-ink">
          {t.lastNameLabel}
          <input
            aria-label={t.lastNameLabel}
            className={inputCls}
            placeholder={t.lastNamePlaceholder}
            autoComplete="family-name"
            value={form.lastName}
            onChange={set('lastName')}
          />
        </label>
      </div>
      <label htmlFor={`${formId}-email`} className="text-label-md text-ink">
        {t.emailLabel}
      </label>
      <input
        id={`${formId}-email`}
        aria-describedby={error ? `${formId}-error` : undefined}
        aria-label={t.emailLabel}
        className={inputCls}
        placeholder={t.emailPlaceholder}
        type="email"
        autoComplete="email"
        value={form.email}
        onChange={set('email')}
      />
      <label htmlFor={`${formId}-password`} className="text-label-md text-ink">
        {t.passwordLabel}
      </label>
      <input
        id={`${formId}-password`}
        aria-describedby={error ? `${formId}-error` : undefined}
        aria-label={t.passwordLabel}
        className={inputCls}
        placeholder={t.registerPasswordPlaceholder}
        type="password"
        onFocus={() => setPasswordFocused(true)}
        onBlur={() => setPasswordFocused(false)}
        autoComplete="new-password"
        value={form.password}
        onChange={set('password')}
      />
      {error && (
        <p
          id={`${formId}-error`}
          role="alert"
          className="rounded-xl bg-error/5 p-3 text-body-sm text-error"
        >
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={submitCls}>
        {busy ? t.creating : t.createAccount}
      </button>
      <p className="text-center text-body-sm text-muted">
        {t.haveAccount}{' '}
        <button type="button" onClick={onSwitch} className="text-ink font-medium hover:text-accent">
          {t.login}
        </button>
      </p>
    </form>
  );
}
