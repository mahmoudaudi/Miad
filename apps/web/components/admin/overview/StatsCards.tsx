import React from 'react';
import { AdminIcon, type AdminIconTone } from '../AdminIcon';
import {
  formatCompact,
  formatMoney,
  type AdminOverview,
} from '@/lib/admin';

function KpiCard({
  label,
  icon,
  tone,
  value,
  children,
}: {
  label: string;
  icon: string;
  tone: AdminIconTone;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between space-y-3 rounded-xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#47464b]">
          {label}
        </span>
        <AdminIcon icon={icon} tone={tone} label={label} />
      </div>
      <div>
        <div className="text-[36px] font-semibold leading-[44px] tracking-[-0.035em] text-[#1a1b22]">
          {value}
        </div>
        <div className="mt-1 flex items-center justify-between pt-1">{children}</div>
      </div>
    </div>
  );
}

function Trend({ value, suffix }: { value: number; suffix: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="inline-flex items-center bg-[#6ffbbe]/20 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#005236]">
        <span className="material-symbols-outlined text-[12px] leading-none" aria-hidden="true">
          north_east
        </span>
        {value}%
      </span>
      <span className="text-[11px] text-[#47464b]">{suffix}</span>
    </div>
  );
}

function MonoNote({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span
      className={`font-mono text-[11px] font-medium ${accent ? 'text-[#1a1b22]' : 'text-[#47464b]'}`}
    >
      {children}
    </span>
  );
}

/** Four primary KPI cards — every figure is a live aggregate. */
export function KpiCards({ overview }: { overview: AdminOverview }) {
  const { users, invitations, rsvps, revenue } = overview;
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Total Users"
        icon="group"
        tone="burgundy"
        value={users.total.toLocaleString('en-US')}
      >
        <Trend value={users.activeRate} suffix="active rate" />
        <MonoNote accent>Active: {users.active.toLocaleString('en-US')}</MonoNote>
      </KpiCard>
      <KpiCard
        label="Invitations"
        icon="mark_email_read"
        tone="indigo"
        value={invitations.total.toLocaleString('en-US')}
      >
        <MonoNote>
          <span className="bg-[#6ffbbe]/20 px-1.5 py-0.5 font-semibold text-[#005236]">
            Published {invitations.published.toLocaleString('en-US')}
          </span>
        </MonoNote>
        <MonoNote>Draft: {invitations.draft.toLocaleString('en-US')}</MonoNote>
      </KpiCard>
      <KpiCard
        label="Total RSVPs"
        icon="how_to_reg"
        tone="green"
        value={rsvps.total.toLocaleString('en-US')}
      >
        <Trend value={rsvps.attendingRate} suffix="rate" />
        <MonoNote accent>Attending: {formatCompact(rsvps.attending)}</MonoNote>
      </KpiCard>
      <KpiCard
        label="Revenue & Subscriptions"
        icon="payments"
        tone="amber"
        value={formatMoney(revenue.total, revenue.currency)}
      >
        <MonoNote>
          {revenue.total === 0 ? 'No settled payments yet' : `Settled in ${revenue.currency}`}
        </MonoNote>
        <MonoNote accent>Active Subs: {revenue.activeSubscriptions.toLocaleString('en-US')}</MonoNote>
      </KpiCard>
    </div>
  );
}

/** AI telemetry strip — counts and success rate from the ai_usage table. */
export function AiStrip({ overview }: { overview: AdminOverview }) {
  const { ai } = overview;
  const cells: Array<{
    label: string;
    icon: string;
    tone: AdminIconTone;
    value: string;
    valueClass: string;
  }> = [
    {
      label: 'AI Generations',
      icon: 'auto_awesome',
      tone: 'indigo',
      value: ai.generations.toLocaleString('en-US'),
      valueClass: 'text-[#1a1b22]',
    },
    {
      label: 'AI Refinements',
      icon: 'tune',
      tone: 'slate',
      value: ai.refinements.toLocaleString('en-US'),
      valueClass: 'text-[#1a1b22]',
    },
    {
      label: 'AI Success Rate',
      icon: 'check_circle',
      tone: 'green',
      value: `${ai.successRate}%`,
      valueClass: 'text-[#005236]',
    },
    {
      label: 'Failed AI Requests',
      icon: 'warning',
      tone: 'red',
      value: `${ai.failed.toLocaleString('en-US')} (${toRate(ai.failed, ai.successful + ai.failed)}%)`,
      valueClass: 'text-[#ba1a1a]',
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 rounded-xl border border-[#e3e1ec] bg-white p-2 text-[#1a1b22] shadow-sm sm:grid-cols-4">
      {cells.map((cell) => (
        <div key={cell.label} className="flex items-center gap-2.5 rounded-lg bg-[#f4f2fd] px-3 py-1.5">
          <AdminIcon icon={cell.icon} tone={cell.tone} size={16} label={cell.label} />
          <div className="min-w-0">
            <span className="block truncate text-[10px] font-medium uppercase tracking-wider text-[#47464b]">
              {cell.label}
            </span>
            <span className={`font-mono text-[13px] font-semibold ${cell.valueClass}`}>
              {cell.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function toRate(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}
