import React from 'react';
import { AdminIcon, type AdminIconTone } from '../AdminIcon';
import type { AdminAnalytics } from '@/lib/admin';

function Card({
  label,
  icon,
  tone,
  value,
  sub,
}: {
  label: string;
  icon: string;
  tone: AdminIconTone;
  value: React.ReactNode;
  sub: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#47464b]">
          {label}
        </span>
        <AdminIcon icon={icon} tone={tone} size={16} label={label} />
      </div>
      <div className="my-2">
        <div className="text-[36px] font-semibold leading-[44px] tracking-[-0.035em] text-[#1a1b22]">
          {value}
        </div>
      </div>
      <div className="flex items-center gap-1.5 pt-1 text-[12px]">{sub}</div>
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-[#7d1128] to-[#4648d4] opacity-80" />
    </div>
  );
}

/** Engagement KPI row — new users, creators, publishing, and RSVP response. */
export function AnalyticsKpis({ data }: { data: AdminAnalytics }) {
  const { kpis } = data;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card
        label="New Users"
        icon="person_add"
        tone="burgundy"
        value={kpis.newUsers.toLocaleString('en-US')}
        sub={
          <>
            <span className="inline-flex items-center rounded bg-[#6ffbbe]/20 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#005236]">
              {kpis.newUsersTrend >= 0 ? '+' : ''}
              {kpis.newUsersTrend}%
            </span>
            <span className="font-mono text-[11px] text-[#47464b]">vs previous period</span>
          </>
        }
      />
      <Card
        label="Active Creators"
        icon="auto_awesome"
        tone="indigo"
        value={kpis.activeCreators.toLocaleString('en-US')}
        sub={
          <span className="text-[#47464b]">Users with events or AI runs in range</span>
        }
      />
      <Card
        label="Published in Range"
        icon="publish"
        tone="green"
        value={kpis.published.toLocaleString('en-US')}
        sub={
          <span className="font-mono text-[11px] text-[#47464b]">
            {kpis.publishedRate}% publish rate
          </span>
        }
      />
      <Card
        label="RSVP Responses"
        icon="how_to_reg"
        tone="amber"
        value={kpis.rsvpResponses.toLocaleString('en-US')}
        sub={
          <span className="font-mono text-[11px] text-[#47464b]">
            {kpis.rsvpRate}% attending rate
          </span>
        }
      />
    </div>
  );
}
