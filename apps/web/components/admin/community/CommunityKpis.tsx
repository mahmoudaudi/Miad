import React from 'react';
import { AdminIcon, type AdminIconTone } from '../AdminIcon';
import type { AdminCommunity } from '@/lib/admin';

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
    <div className="flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm">
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
      <div className="pt-1 text-[12px] text-[#47464b]">{sub}</div>
    </div>
  );
}

/** Community KPI row — live design counts and engagement counters. */
export function CommunityKpis({ data }: { data: AdminCommunity }) {
  const { kpis } = data;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card
        label="Published Designs"
        icon="gallery_thumbnail"
        tone="indigo"
        value={kpis.published.toLocaleString('en-US')}
        sub={`Active community designs • +${kpis.newThisWeek.toLocaleString('en-US')} this week`}
      />
      <Card
        label="Total Views"
        icon="visibility"
        tone="green"
        value={kpis.totalViews.toLocaleString('en-US')}
        sub="Summed design view counters"
      />
      <Card
        label="Total Likes"
        icon="favorite"
        tone="burgundy"
        value={kpis.totalLikes.toLocaleString('en-US')}
        sub="Summed design like counters"
      />
      <Card
        label="Hidden Designs"
        icon="visibility_off"
        tone="slate"
        value={kpis.hidden.toLocaleString('en-US')}
        sub={kpis.hidden === 0 ? 'Nothing hidden' : 'Unpublished from the showcase'}
      />
    </div>
  );
}
