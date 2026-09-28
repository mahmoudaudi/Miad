import React from 'react';
import { formatMoney, type AdminBilling } from '@/lib/admin';

/** Live plan cards: stored prices, real subscriber counts, derived MRR/ARR. */
export function TiersGrid({ data }: { data: AdminBilling }) {
  const maxSubs = Math.max(0, ...data.tiers.map((t) => t.subscribers));
  const popular = data.tiers.find((t) => t.subscribers === maxSubs && maxSubs > 0)?.plan;
  if (data.tiers.length === 0) {
    return (
      <section className="rounded-xl bg-white p-6 text-center shadow-sm">
        <h2 className="text-[18px] font-semibold text-[#1a1b22]">Tier Distribution</h2>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-[#47464b]">
          No billing plans are configured yet. Create plans in the database and
          subscription tiers will appear here with live counts.
        </p>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-semibold leading-[24px] tracking-[-0.02em] text-[#1a1b22]">
          Tier Distribution
        </h2>
        <span className="rounded bg-[#e8e7f1] px-2 py-0.5 font-mono text-[10px] uppercase text-[#47464b]">
          Plan Breakdown
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        {data.tiers.map((tier) => (
          <div
            key={tier.plan}
            className="relative flex flex-col justify-between overflow-hidden rounded-xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            {tier.plan === popular ? (
              <div className="absolute right-0 top-0 rounded-bl bg-[#7d1128] px-2.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white">
                Most Popular
              </div>
            ) : null}
            <div>
              <div className="flex items-center justify-between pb-2">
                <span className="rounded bg-[#f4f2fd] px-2 py-0.5 font-mono text-[11px] font-medium uppercase text-[#47464b]">
                  {tier.plan}
                </span>
                <span className="font-mono text-[18px] font-semibold text-[#1a1b22]">
                  {formatMoney(tier.price, data.kpis.currency)}
                  <span className="text-[11px] font-normal text-[#47464b]">/{tier.interval.toLowerCase()}</span>
                </span>
              </div>
              <div className="my-3 flex flex-col gap-2">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-[#47464b]">Subscribers:</span>
                  <span className="font-mono font-semibold text-[#1a1b22]">
                    {tier.subscribers.toLocaleString('en-US')}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e8e7f1]">
                  <div
                    className="h-full rounded-full bg-[#7d1128]"
                    style={{ width: `${maxSubs === 0 ? 0 : (tier.subscribers / maxSubs) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-[#e3e1ec] pt-2 font-mono text-[11px]">
              <span className="text-[#47464b]">Yield MRR:</span>
              <span className="font-bold text-[#1a1b22]">
                {formatMoney(tier.mrr, data.kpis.currency)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
