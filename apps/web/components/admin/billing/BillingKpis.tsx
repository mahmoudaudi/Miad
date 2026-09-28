import React from 'react';
import { AdminIcon, type AdminIconTone } from '../AdminIcon';
import { formatMoney, type AdminBilling } from '@/lib/admin';

function Card({
  label,
  icon,
  tone,
  value,
  footer,
}: {
  label: string;
  icon: string;
  tone: AdminIconTone;
  value: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl bg-white p-5 shadow-sm">
      <div className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-[#eeedf7] blur-xl transition-all group-hover:bg-[#e8e7f1]" />
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#47464b]">
          {label}
        </span>
        <AdminIcon icon={icon} tone={tone} size={16} label={label} />
      </div>
      <div className="my-3">
        <div className="text-[36px] font-semibold leading-[44px] tracking-[-0.035em] text-[#1a1b22]">
          {value}
        </div>
      </div>
      <div className="flex items-center justify-between pt-1 text-[12px]">{footer}</div>
    </div>
  );
}

/** Billing KPI row — settled revenue, MRR, subscription movement, churn. */
export function BillingKpis({ data }: { data: AdminBilling }) {
  const { kpis } = data;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Card
        label="Total Revenue"
        icon="payments"
        tone="amber"
        value={formatMoney(kpis.totalRevenue, kpis.currency)}
        footer={
          <>
            <span className="rounded-full bg-[#f4f2fd] px-1.5 py-0.5 font-mono text-[11px] text-[#005236]">
              MRR: {formatMoney(kpis.mrr, kpis.currency)}
            </span>
            <span className="text-[#47464b]">
              ARR {formatMoney(kpis.mrr * 12, kpis.currency)}
            </span>
          </>
        }
      />
      <Card
        label="Active Subscriptions"
        icon="credit_card"
        tone="indigo"
        value={kpis.activeSubscriptions.toLocaleString('en-US')}
        footer={
          <>
            <span className="font-mono text-[11px] uppercase text-[#47464b]">Paid Tiers</span>
            <span className="font-medium text-[#1a1b22]">
              {kpis.activeSubscriptions === 0 ? 'None yet' : 'Across plans'}
            </span>
          </>
        }
      />
      <Card
        label="New Subscriptions (30D)"
        icon="trending_up"
        tone="green"
        value={`+${kpis.newSubs30d.toLocaleString('en-US')}`}
        footer={
          <span className="text-[#47464b]">
            {kpis.newSubs30d === 0 ? 'No new subscriptions' : 'Started in the last 30 days'}
          </span>
        }
      />
      <Card
        label="Ended / Churn"
        icon="person_remove"
        tone="slate"
        value={
          <>
            {kpis.endedSubs.toLocaleString('en-US')}{' '}
            <span className="text-[18px] font-normal text-[#47464b]">accounts</span>
          </>
        }
        footer={
          <>
            <span className="font-mono text-[11px] font-medium text-[#4648d4]">
              {kpis.churnRate}% Churn Rate
            </span>
            <span className="text-[#47464b]">{100 - kpis.churnRate}% Retained</span>
          </>
        }
      />
    </div>
  );
}
