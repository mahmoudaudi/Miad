import React from 'react';
import { AdminIcon, type AdminIconTone } from '../AdminIcon';
import type { AdminUsersResponse } from '@/lib/admin';

function Card({
  label,
  icon,
  tone,
  badge,
  value,
  sub,
  valueClass,
}: {
  label: string;
  icon: string;
  tone: AdminIconTone;
  badge: React.ReactNode;
  value: React.ReactNode;
  sub: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AdminIcon icon={icon} tone={tone} size={16} label={label} />
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#47464b]">
            {label}
          </span>
        </div>
        {badge}
      </div>
      <div className="mt-4">
        <div
          className={`text-[36px] font-semibold leading-[44px] tracking-[-0.035em] ${valueClass ?? 'text-[#1a1b22]'}`}
        >
          {value}
        </div>
        <div className="mt-1 flex items-center gap-1 text-[12px] text-[#47464b]">{sub}</div>
      </div>
    </div>
  );
}

/** Users KPI row — totals, week-over-week growth, 30-day activity, suspensions. */
export function UsersKpis({ data }: { data: AdminUsersResponse }) {
  const { kpis, distribution } = data;
  const engagement =
    kpis.total === 0 ? 0 : Math.round((kpis.active30d / kpis.total) * 1000) / 10;
  const planSplit = distribution
    .slice(0, 3)
    .map((d) => `${d.plan}: ${d.count.toLocaleString('en-US')}`)
    .join(' • ');
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card
        label="Total Registered Users"
        icon="group"
        tone="burgundy"
        badge={
          <span className="flex items-center gap-0.5 rounded bg-[#eeedf7] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[#005236]">
            <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
              trending_up
            </span>
            {kpis.growthRate >= 0 ? '+' : ''}
            {kpis.growthRate}%
          </span>
        }
        value={kpis.total.toLocaleString('en-US')}
        sub={
          <>
            <span>+{kpis.newThisWeek.toLocaleString('en-US')} this week</span>
            <span className="text-[#c8c5cb]">•</span>
            <span>week over week</span>
          </>
        }
      />
      <Card
        label="Active Users"
        icon="person_check"
        tone="green"
        badge={
          <span className="rounded bg-[#f4f2fd] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[#4648d4]">
            Last 30 days
          </span>
        }
        value={kpis.active30d.toLocaleString('en-US')}
        sub={<span>{engagement}% engagement rate</span>}
      />
      <Card
        label="Active Subscriptions"
        icon="loyalty"
        tone="amber"
        badge={
          <span className="rounded bg-[#eeedf7] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[#1a1b22]">
            {kpis.activeSubscriptions.toLocaleString('en-US')} paid
          </span>
        }
        value={kpis.activeSubscriptions.toLocaleString('en-US')}
        sub={<span className="truncate text-[11px]">{planSplit || 'No subscriptions yet'}</span>}
      />
      <Card
        label="Suspended / Flagged"
        icon="gavel"
        tone="red"
        badge={
          kpis.suspended > 0 ? (
            <span className="rounded bg-[#ffdad6]/40 px-1.5 py-0.5 font-mono text-[11px] font-medium text-[#ba1a1a]">
              Requires action
            </span>
          ) : (
            <span className="rounded bg-[#6ffbbe]/20 px-1.5 py-0.5 font-mono text-[11px] font-medium text-[#005236]">
              All clear
            </span>
          )
        }
        value={
          <>
            {kpis.suspended.toLocaleString('en-US')}{' '}
            <span className="text-[13px] font-normal text-[#47464b]">accounts</span>
          </>
        }
        valueClass={kpis.suspended > 0 ? 'text-[#ba1a1a]' : 'text-[#1a1b22]'}
        sub={
          <span>
            {kpis.suspended > 0
              ? 'Deactivated accounts awaiting review'
              : 'No accounts need action'}
          </span>
        }
      />
    </div>
  );
}
