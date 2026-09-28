'use client';

import React, { useState } from 'react';
import { isValidEmail } from '@/lib/validators';

export type InviteUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: string;
};

/**
 * Manual provisioning form — the portal counterpart of creating credentials
 * directly. Mirrors the public registration rules (plus role).
 */
export function InviteUserModal({
  busy,
  serverError,
  onSubmit,
  onClose,
}: {
  busy: boolean;
  serverError: string | null;
  onSubmit: (input: InviteUserInput) => void;
  onClose: () => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!firstName.trim() || !lastName.trim()) {
      setError('First and last name are required.');
      return;
    }
    if (!isValidEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 10) {
      setError('Password must be at least 10 characters.');
      return;
    }
    setError(null);
    onSubmit({ firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), password, role });
  }

  const inputCls =
    'h-9 w-full rounded-lg border border-[#c8c5cb] bg-white px-2.5 text-[13px] text-[#1a1b22] placeholder:text-[#47464b]/60 focus:border-[#1a1b22] focus:outline-none disabled:opacity-60';
  const labelCls = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[#47464b]';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Invite user"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#1a1b22]/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[16px] font-semibold text-[#1a1b22]">Invite Admin / User</h2>
        <p className="mt-0.5 text-[12px] text-[#47464b]">
          Creates the account immediately with the chosen role.
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-3" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} htmlFor="invite-first">First name</label>
              <input id="invite-first" value={firstName} disabled={busy} onChange={(e) => setFirstName(e.target.value)} className={inputCls} autoComplete="off" />
            </div>
            <div>
              <label className={labelCls} htmlFor="invite-last">Last name</label>
              <input id="invite-last" value={lastName} disabled={busy} onChange={(e) => setLastName(e.target.value)} className={inputCls} autoComplete="off" />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="invite-email">Email</label>
            <input id="invite-email" type="email" value={email} disabled={busy} onChange={(e) => setEmail(e.target.value)} className={inputCls} autoComplete="off" />
          </div>
          <div>
            <label className={labelCls} htmlFor="invite-password">Password</label>
            <input id="invite-password" type="password" value={password} disabled={busy} onChange={(e) => setPassword(e.target.value)} placeholder="Min 10 characters" className={inputCls} autoComplete="new-password" />
          </div>
          <div>
            <label className={labelCls} htmlFor="invite-role">Role</label>
            <select id="invite-role" value={role} disabled={busy} onChange={(e) => setRole(e.target.value)} className={inputCls}>
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {error || serverError ? (
            <p role="alert" className="text-[13px] font-medium text-[#93000a]">
              {error ?? serverError}
            </p>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-lg bg-[#f4f2fd] px-3 py-1.5 text-[13px] font-medium text-[#1a1b22] hover:bg-[#e8e7f1] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#7d1128] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#670e21] disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                person_add
              </span>
              {busy ? 'Creating…' : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
