'use client';

import { useSearchParams } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react';
import { useAdminSession } from '../AdminShell';
import { ConfirmDialog } from '../ConfirmDialog';
import {
  createAdminUser,
  deleteAdminUser,
  downloadUsersCsv,
  getUsersSummary,
  getUsersTable,
  isAbortError,
  setAdminUserRole,
  setAdminUserStatus,
  type AdminUserItem,
  type AdminUsersFilters,
  type AdminUsersResponse,
  type AdminUsersSummary,
  type AdminUsersTable,
} from '@/lib/admin';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/components/ui/ToastProvider';
import { InviteUserModal, type InviteUserInput } from './InviteUserModal';
import { UsersKpis } from './UsersKpis';
import { UsersSidePanel } from './UsersSidePanel';
import { UsersTable } from './UsersTable';

type ConfirmState =
  | { type: 'suspend'; user: AdminUserItem }
  | { type: 'activate'; user: AdminUserItem }
  | { type: 'delete'; user: AdminUserItem }
  | null;

function friendlyError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message || fallback;
  return fallback;
}

/** Users Management: live directory, filters, provisioning, and moderation. */
export function UsersView() {
  const session = useAdminSession();
  const showToast = useToast();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<AdminUsersFilters>({ sort: 'newest', page: 1, limit: 8 });

  // Header search and owner deep-links drive the table filter through the URL.
  // The applied ref keeps table typing (which doesn't touch the URL) independent.
  const appliedSearchRef = React.useRef<string | null>(null);
  const urlSearch = searchParams.get('search')?.trim() ?? '';
  useEffect(() => {
    if (appliedSearchRef.current === urlSearch) return;
    appliedSearchRef.current = urlSearch;
    setFilters((prev) => ({ ...prev, search: urlSearch || undefined, page: 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearch]);
  const [summary, setSummary] = useState<AdminUsersSummary | null>(null);
  const [table, setTable] = useState<AdminUsersTable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshToken, setRefreshToken] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Summary (KPIs, distribution, top AI) loads once — never on table page turns.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getUsersSummary()
      .then((res) => {
        if (!cancelled) setSummary(res);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load users. Check the API connection and retry.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  // Table page alone (4 scoped queries instead of ~12 full-table ones).
  // The AbortController cancels the in-flight request when filters change
  // mid-flight, so fast typing doesn't pile up pool checkouts server-side.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    getUsersTable(filters, controller.signal)
      .then((res) => {
        if (!cancelled) setTable(res);
      })
      .catch((error: unknown) => {
        if (!cancelled && !isAbortError(error)) showToast('Could not refresh the table.', 'error');
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters), refreshToken]);

  const patchFilters = useCallback((patch: Partial<AdminUsersFilters>, resetPage = false) => {
    setFilters((prev) => ({ ...prev, ...patch, ...(resetPage ? { page: 1 } : {}) }));
  }, []);

  const refresh = useCallback(() => setRefreshToken((t) => t + 1), []);

  async function handleInvite(input: InviteUserInput) {
    setInviteBusy(true);
    setInviteError(null);
    try {
      await createAdminUser(input);
      showToast('Account created.', 'success');
      setInviteOpen(false);
      refresh();
    } catch (err) {
      setInviteError(friendlyError(err, 'Could not create the account.'));
    } finally {
      setInviteBusy(false);
    }
  }

  async function runMutation(user: AdminUserItem, label: string, fn: () => Promise<unknown>) {
    setBusyId(user.id);
    try {
      await fn();
      showToast(label, 'success');
      setConfirm(null);
      refresh();
    } catch (err) {
      showToast(friendlyError(err, 'Action failed.'), 'error');
    } finally {
      setBusyId(null);
    }
  }

  const plans = summary?.distribution.map((d) => d.plan) ?? [];
  const data: AdminUsersResponse | null =
    summary && table ? { ...summary, table } : null;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4 p-5 lg:p-8">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider">
            <span className="font-medium text-[#4648d4]">Directory &amp; Access</span>
            <span className="text-[#c8c5cb]">•</span>
            <span className="text-[#47464b]">Live Synchronized</span>
          </div>
          <h1 className="text-[24px] font-semibold leading-[32px] tracking-[-0.025em] text-[#1a1b22]">
            Users Management
          </h1>
          <p className="mt-0.5 text-[13px] text-[#47464b]">
            View, manage, and monitor all platform users, their subscription plans, and AI usage.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => data && downloadUsersCsv(data.table.items)}
            disabled={!data || data.table.items.length === 0}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-white px-3 text-[13px] font-medium text-[#1a1b22] shadow-sm transition-colors hover:bg-[#f4f2fd] disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px] text-[#47464b]" aria-hidden="true">
              download
            </span>
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setInviteError(null);
              setInviteOpen(true);
            }}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-[#7d1128] px-3 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#670e21]"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              person_add
            </span>
            Invite Admin / User
          </button>
        </div>
      </div>

      {loading && !summary ? (
        <div aria-busy="true" aria-live="polite" className="space-y-4">
          <span className="sr-only">Loading users…</span>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-36 animate-pulse rounded-xl bg-white shadow-sm" />
            ))}
          </div>
          <div className="h-96 animate-pulse rounded-xl bg-white shadow-sm" />
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="rounded-xl bg-white p-6 text-center shadow-sm">
          <p className="text-[14px] font-medium text-[#93000a]">{error}</p>
          <button
            type="button"
            onClick={refresh}
            className="mt-3 rounded-lg bg-[#7d1128] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#670e21]"
          >
            Retry
          </button>
        </div>
      ) : null}

      {data ? (
        <>
          <UsersKpis data={data} />
          <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-12">
            <UsersTable
              table={data.table}
              plans={plans}
              filters={filters}
              onFiltersChange={patchFilters}
              onToggleStatus={(user) =>
                setConfirm(user.isActive ? { type: 'suspend', user } : { type: 'activate', user })
              }
              onChangeRole={(user, role) =>
                runMutation(user, `Role changed to ${role}.`, () => setAdminUserRole(user.id, role))
              }
              onDelete={(user) => setConfirm({ type: 'delete', user })}
              sessionUserId={session.id}
              busyId={busyId}
            />
            <UsersSidePanel data={data} />
          </div>
        </>
      ) : null}

      {inviteOpen ? (
        <InviteUserModal
          busy={inviteBusy}
          serverError={inviteError}
          onSubmit={handleInvite}
          onClose={() => setInviteOpen(false)}
        />
      ) : null}

      {confirm ? (
        <ConfirmDialog
          title={
            confirm.type === 'delete'
              ? 'Delete account?'
              : confirm.type === 'suspend'
                ? 'Suspend user?'
                : 'Activate user?'
          }
          message={
            confirm.type === 'delete'
              ? `${confirm.user.email} will be permanently deleted. Accounts with platform data cannot be deleted — suspend them instead.`
              : confirm.type === 'suspend'
                ? `${confirm.user.email} will lose access immediately. You can reactivate them later.`
                : `${confirm.user.email} will regain access immediately.`
          }
          confirmLabel={
            confirm.type === 'delete' ? 'Delete' : confirm.type === 'suspend' ? 'Suspend' : 'Activate'
          }
          danger={confirm.type === 'delete' || confirm.type === 'suspend'}
          busy={busyId === confirm.user.id}
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            const { user, type } = confirm;
            if (type === 'delete') {
              runMutation(user, 'Account deleted.', () => deleteAdminUser(user.id));
            } else {
              runMutation(user, type === 'suspend' ? 'User suspended.' : 'User activated.', () =>
                setAdminUserStatus(user.id, type === 'activate')
              );
            }
          }}
        />
      ) : null}
    </div>
  );
}
