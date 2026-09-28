import React from 'react';
import { AdminIcon, type AdminIconTone } from '../AdminIcon';
import type { AdminInvitationsResponse } from '@/lib/admin';

/** 30-day mini area chart built from live daily buckets. */
export function Sparkline({ data, stroke }: { data: number[]; stroke: string }) {
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => ({
    x: data.length <= 1 ? 50 : (i * 100) / (data.length - 1),
    y: 22 - (v / max) * 19,
  }));
  const line = pts.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ');
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg className="h-6 w-full" preserveAspectRatio="none" viewBox="0 0 100 24" aria-hidden="true">
      <defs>
        <linearGradient id={`sp-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.12" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`M ${line} L 100 24 L 0 24 Z`} fill={`url(#sp-${id})`} />
      <path d={`M ${line}`} fill="none" stroke={stroke} strokeWidth="2" />
    </svg>
  );
}

function Card({
  label,
  icon,
  tone,
  badge,
  children,
  spark,
}: {
  label: string;
  icon: string;
  tone: AdminIconTone;
  badge: React.ReactNode;
  children: React.ReactNode;
  spark: React.ReactNode;
}) {
  return (
    <div className="group flex flex-col justify-between rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AdminIcon icon={icon} tone={tone} size={16} label={label} />
          <span className="text-[11px] font-medium uppercase tracking-wider text-[#47464b]">
            {label}
          </span>
        </div>
        {badge}
      </div>
      <div className="mt-3">{children}</div>
      <div className="mt-3">{spark}</div>
    </div>
  );
}

/** Directory KPI row — totals, lifecycle split, weekly intake, RSVP traffic. */
export function InvitationsKpis({ data }: { data: AdminInvitationsResponse }) {
  const { kpis } = data;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card
        label="Total Invitations"
        icon="mark_email_read"
        tone="indigo"
        badge={
          <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 font-mono text-[11px] font-medium text-[#7d1128]">
            <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
              trending_up
            </span>
            {kpis.growthRate >= 0 ? '+' : ''}
            {kpis.growthRate}%
          </span>
        }
        spark={<Sparkline data={kpis.creations30d} stroke="#7d1128" />}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-[24px] font-semibold leading-[32px] tracking-[-0.025em] text-[#1a1b22]">
            {kpis.total.toLocaleString('en-US')}
          </span>
          <span className="text-[12px] text-[#47464b]">total events</span>
        </div>
      </Card>

      <Card
        label="Published & Draft"
        icon="publish"
        tone="green"
        badge={
          <span className="inline-flex items-center gap-0.5 rounded bg-[#f4f2fd] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[#005236]">
            {kpis.publishedRate}% Live
          </span>
        }
        spark={<Sparkline data={kpis.published30d} stroke="#005236" />}
      >
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-[24px] font-semibold leading-[32px] tracking-[-0.025em] text-[#1a1b22]">
              {kpis.published.toLocaleString('en-US')}
            </span>
            <span className="ml-1 text-[12px] text-[#47464b]">Published</span>
          </div>
          <div className="text-right">
            <span className="font-mono text-[14px] font-semibold text-[#1a1b22]">
              {kpis.draft.toLocaleString('en-US')}
            </span>
            <span className="ml-1 text-[11px] text-[#47464b]">Draft</span>
          </div>
        </div>
      </Card>

      <Card
        label="New This Week"
        icon="event_upcoming"
        tone="burgundy"
        badge={
          <span className="inline-flex items-center gap-0.5 rounded bg-[#f4f2fd] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[#4648d4]">
            Last 7 days
          </span>
        }
        spark={<Sparkline data={kpis.creations30d.slice(-7)} stroke="#4648d4" />}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-[24px] font-semibold leading-[32px] tracking-[-0.025em] text-[#1a1b22]">
            {kpis.newThisWeek.toLocaleString('en-US')}
          </span>
          <span className="text-[12px] text-[#47464b]">new invitations</span>
        </div>
      </Card>

      <Card
        label="Total RSVPs"
        icon="how_to_reg"
        tone="amber"
        badge={
          <span className="inline-flex items-center gap-1 rounded bg-[#f4f2fd] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[#47464b]">
            <span className="material-symbols-outlined text-[12px] text-[#4648d4]" aria-hidden="true">
              visibility
            </span>
            {kpis.totalViews.toLocaleString('en-US')} Views
          </span>
        }
        spark={<Sparkline data={kpis.creations30d} stroke="#77767b" />}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-[24px] font-semibold leading-[32px] tracking-[-0.025em] text-[#1a1b22]">
            {kpis.totalRsvps.toLocaleString('en-US')}
          </span>
          <span className="text-[12px] text-[#47464b]">RSVPs compiled</span>
        </div>
      </Card>
    </div>
  );
}
