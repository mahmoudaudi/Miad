'use client';

import React, { useEffect, useState } from 'react';
import { initialsOf, type AdminUserItem, type AdminUsersFilters } from '@/lib/admin';

function RolePill({ role }: { role: string }) {
  const isAdmin = role === 'admin';
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-[11px] font-medium ${
        isAdmin ? 'bg-[#7d1128] text-white' : 'bg-[#eeedf7] text-[#47464b]'
      }`}
    >
      {role === 'admin' ? 'Admin' : role === 'user' ? 'User' : role}
    </span>
  );
}

function StatusPill({ isActive }: { isActive: boolean }) {
  return isActive ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#4edea3]/20 px-2 py-0.5 font-mono text-[11px] font-medium text-[#005236]">
      <span className="h-1.5 w-1.5 rounded-full bg-[#005236]" />
      Active
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-[#ffdad6] px-2 py-0.5 font-mono text-[11px] font-medium text-[#ba1a1a]"
      title="Deactivated account"
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ba1a1a]" />
      Suspended
    </span>
  );
}

function ActionButton({
  title,
  icon,
  onClick,
  disabled,
  danger,
}: {
  title: string;
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`rounded p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        danger
          ? 'text-[#47464b] hover:bg-[#ffdad6]/40 hover:text-[#ba1a1a]'
          : 'text-[#47464b] hover:bg-[#eeedf7] hover:text-[#1a1b22]'
      }`}
    >
      <span className="material-symbols-outlined text-[17px]" aria-hidden="true">
        {icon}
      </span>
    </button>
  );
}

/**
 * Users directory table. Search, plan, status, joined-range, and sort are
 * server-side; every action (details, suspend/activate, role, delete) is real.
 */
export function UsersTable({
  table,
  plans,
  filters,
  onFiltersChange,
  onToggleStatus,
  onChangeRole,
  onDelete,
  sessionUserId,
  busyId,
}: {
  table: { items: AdminUserItem[]; page: number; limit: number; total: number; totalPages: number };
  plans: string[];
  filters: AdminUsersFilters;
  onFiltersChange: (patch: Partial<AdminUsersFilters>, resetPage?: boolean) => void;
  onToggleStatus: (user: AdminUserItem) => void;
  onChangeRole: (user: AdminUserItem, role: string) => void;
  onDelete: (user: AdminUserItem) => void;
  sessionUserId: string;
  busyId: string | null;
}) {
  const [draft, setDraft] = useState(filters.search ?? '');
  const [detailFor, setDetailFor] = useState<string | null>(null);
  const [roleFor, setRoleFor] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft !== (filters.search ?? '')) onFiltersChange({ search: draft }, true);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  // External presets (e.g. ?search= deep links) sync into the input.
  useEffect(() => {
    setDraft(filters.search ?? '');
  }, [filters.search]);

  const maxAi = Math.max(1, ...table.items.map((i) => i.aiRuns));
  const from = table.total === 0 ? 0 : (table.page - 1) * table.limit + 1;
  const to = Math.min(table.total, (table.page - 1) * table.limit + table.items.length);
  const selectCls =
    'h-8 rounded-lg bg-[#f4f2fd] pl-2.5 pr-7 text-[12px] text-[#1a1b22] appearance-none focus:outline-none cursor-pointer';

  return (
    <div className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm xl:col-span-8">
      <div className="flex flex-col items-stretch justify-between gap-2 bg-white p-3 lg:flex-row lg:items-center">
        <div className="relative max-w-lg flex-1">
          <span
            className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#47464b]"
            aria-hidden="true"
          >
            search
          </span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search by name or email..."
            type="text"
            className="h-8 w-full rounded-lg bg-[#f4f2fd] pl-8 pr-3 text-[12px] text-[#1a1b22] placeholder:text-[#47464b]/60 shadow-sm focus:bg-white focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative">
            <select
              value={filters.plan ?? ''}
              onChange={(e) => onFiltersChange({ plan: e.target.value || undefined }, true)}
              className={selectCls}
              aria-label="Filter by plan"
            >
              <option value="">All Plans</option>
              {plans.map((plan) => (
                <option key={plan} value={plan}>
                  {plan}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[16px] text-[#47464b]" aria-hidden="true">
              expand_more
            </span>
          </div>
          <div className="relative">
            <select
              value={filters.status ?? ''}
              onChange={(e) =>
                onFiltersChange(
                  { status: (e.target.value || undefined) as AdminUsersFilters['status'] },
                  true
                )
              }
              className={selectCls}
              aria-label="Filter by status"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[16px] text-[#47464b]" aria-hidden="true">
              expand_more
            </span>
          </div>
          <div className="relative">
            <select
              value={filters.joined ?? ''}
              onChange={(e) =>
                onFiltersChange(
                  { joined: (e.target.value || undefined) as AdminUsersFilters['joined'] },
                  true
                )
              }
              className={selectCls}
              aria-label="Filter by join date"
            >
              <option value="">Joined: Any time</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[16px] text-[#47464b]" aria-hidden="true">
              expand_more
            </span>
          </div>
          <div className="relative">
            <select
              value={filters.sort ?? 'newest'}
              onChange={(e) =>
                onFiltersChange({ sort: e.target.value as AdminUsersFilters['sort'] }, true)
              }
              className={selectCls}
              aria-label="Sort users"
            >
              <option value="newest">Newest first</option>
              <option value="invitations">Most invitations</option>
              <option value="aiRuns">Most AI runs</option>
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[16px] text-[#47464b]" aria-hidden="true">
              expand_more
            </span>
          </div>
          <button
            type="button"
            title="Clear filters"
            onClick={() => {
              setDraft('');
              onFiltersChange({ search: undefined, plan: undefined, status: undefined, joined: undefined, sort: 'newest' }, true);
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f4f2fd] text-[#1a1b22] transition-colors hover:bg-[#eeedf7]"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
              filter_alt_off
            </span>
          </button>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="select-none bg-[#e8e7f1]/40 font-mono text-[11px] uppercase tracking-wider text-[#47464b]">
              <th className="px-4 py-2.5 font-medium">User Profile</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="px-4 py-2.5 font-medium">Plan</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Registered</th>
              <th className="px-4 py-2.5 font-medium">Invitations</th>
              <th className="px-4 py-2.5 font-medium">AI Runs</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="text-[13px] text-[#1a1b22]">
            {table.items.map((user) => {
              const isSelf = user.id === sessionUserId;
              const busy = busyId === user.id;
              const name = `${user.firstName} ${user.lastName}`.trim() || user.email;
              return (
                <React.Fragment key={user.id}>
                  <tr
                    className={`transition-colors hover:bg-[#f4f2fd]/70 ${user.isActive ? '' : 'bg-[#ffdad6]/10'}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                            user.isActive
                              ? 'bg-[#e8e7f1] text-[#1a1b22]'
                              : 'bg-[#ffdad6] text-[#ba1a1a]'
                          }`}
                        >
                          {initialsOf(name)}
                        </span>
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-[13px] font-semibold">
                            {name}
                            {isSelf ? (
                              <span className="ml-1.5 rounded bg-[#eeedf7] px-1 font-mono text-[10px] font-medium text-[#47464b]">
                                You
                              </span>
                            ) : null}
                          </span>
                          <span className="truncate text-[12px] text-[#47464b]">{user.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <RolePill role={user.role} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded bg-[#eeedf7] px-2 py-0.5 font-mono text-[11px] font-medium text-[#47464b]">
                        {user.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill isActive={user.isActive} />
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      <span className="font-medium text-[#1a1b22]">
                        {new Date(user.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] font-semibold">
                      {user.invitationsCount.toLocaleString('en-US')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex w-28 flex-col gap-1">
                        <span className="font-mono text-[11px] font-medium">
                          {user.aiRuns.toLocaleString('en-US')}
                        </span>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-[#eeedf7]">
                          <div
                            className={`h-full rounded-full ${user.isActive ? 'bg-[#7d1128]' : 'bg-[#ba1a1a]'}`}
                            style={{ width: `${(user.aiRuns / maxAi) * 100}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <ActionButton
                          title={detailFor === user.id ? 'Hide details' : 'View details'}
                          icon="visibility"
                          onClick={() => setDetailFor(detailFor === user.id ? null : user.id)}
                        />
                        {user.isActive ? (
                          <ActionButton
                            title={isSelf ? 'You cannot suspend your own account' : 'Suspend user'}
                            icon="block"
                            danger
                            disabled={isSelf || busy}
                            onClick={() => onToggleStatus(user)}
                          />
                        ) : (
                          <ActionButton
                            title="Activate user"
                            icon="check_circle"
                            disabled={isSelf || busy}
                            onClick={() => onToggleStatus(user)}
                          />
                        )}
                        <span className="relative">
                          <ActionButton
                            title={isSelf ? 'You cannot change your own role' : 'Change role'}
                            icon="manage_accounts"
                            disabled={isSelf || busy}
                            onClick={() => setRoleFor(roleFor === user.id ? null : user.id)}
                          />
                          {roleFor === user.id ? (
                            <span className="absolute right-0 top-8 z-10 flex flex-col overflow-hidden rounded-lg border border-[#e3e1ec] bg-white py-1 shadow-md">
                              {['user', 'admin'].map((role) => (
                                <button
                                  key={role}
                                  type="button"
                                  onClick={() => {
                                    setRoleFor(null);
                                    if (role !== user.role) onChangeRole(user, role);
                                  }}
                                  className={`px-4 py-1.5 text-left text-[12px] hover:bg-[#f4f2fd] ${
                                    role === user.role
                                      ? 'font-semibold text-[#7d1128]'
                                      : 'text-[#1a1b22]'
                                  }`}
                                >
                                  {role === 'admin' ? 'Admin' : 'User'}
                                </button>
                              ))}
                            </span>
                          ) : null}
                        </span>
                        <ActionButton
                          title={isSelf ? 'You cannot delete your own account' : 'Delete account'}
                          icon="delete"
                          danger
                          disabled={isSelf || busy}
                          onClick={() => onDelete(user)}
                        />
                      </div>
                    </td>
                  </tr>
                  {detailFor === user.id ? (
                    <tr className="bg-[#f4f2fd]/50">
                      <td colSpan={8} className="px-4 py-3">
                        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px] sm:grid-cols-4">
                          <div>
                            <dt className="font-mono text-[10px] uppercase tracking-wider text-[#47464b]">User ID</dt>
                            <dd className="truncate font-mono text-[11px] text-[#1a1b22]" title={user.id}>{user.id}</dd>
                          </div>
                          <div>
                            <dt className="font-mono text-[10px] uppercase tracking-wider text-[#47464b]">Email</dt>
                            <dd className="truncate text-[#1a1b22]">{user.email}</dd>
                          </div>
                          <div>
                            <dt className="font-mono text-[10px] uppercase tracking-wider text-[#47464b]">Registered</dt>
                            <dd className="text-[#1a1b22]">{new Date(user.createdAt).toLocaleString('en-US')}</dd>
                          </div>
                          <div>
                            <dt className="font-mono text-[10px] uppercase tracking-wider text-[#47464b]">Plan</dt>
                            <dd className="text-[#1a1b22]">{user.plan}</dd>
                          </div>
                        </dl>
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {table.items.length === 0 ? (
          <p className="m-3 rounded-lg bg-[#f4f2fd] p-4 text-center text-[13px] text-[#47464b]">
            No users match these filters.
          </p>
        ) : null}
      </div>

      <div className="flex flex-col items-center justify-between gap-2 bg-white px-4 py-3 sm:flex-row">
        <span className="text-[12px] text-[#47464b]">
          Showing <span className="font-medium text-[#1a1b22]">{from}</span> to{' '}
          <span className="font-medium text-[#1a1b22]">{to}</span> of{' '}
          <span className="font-medium text-[#1a1b22]">{table.total.toLocaleString('en-US')}</span>{' '}
          users
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={table.page <= 1}
            onClick={() => onFiltersChange({ page: table.page - 1 })}
            className="flex h-7 items-center gap-1 rounded bg-[#f4f2fd] px-2 text-[12px] text-[#1a1b22] transition-colors hover:bg-[#e8e7f1] disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
              chevron_left
            </span>
            Prev
          </button>
          <span className="px-1 font-mono text-[12px] text-[#47464b]">
            {table.page} / {table.totalPages}
          </span>
          <button
            type="button"
            disabled={table.page >= table.totalPages}
            onClick={() => onFiltersChange({ page: table.page + 1 })}
            className="flex h-7 items-center gap-1 rounded bg-[#f4f2fd] px-2 text-[12px] text-[#1a1b22] transition-colors hover:bg-[#e8e7f1] disabled:opacity-50"
          >
            Next
            <span className="material-symbols-outlined text-[15px]" aria-hidden="true">
              chevron_right
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
