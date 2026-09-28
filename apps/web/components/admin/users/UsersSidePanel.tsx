import React from 'react';
import { formatMoney, type AdminUsersResponse } from '@/lib/admin';

const PLAN_COLORS = ['#e3e1ec', '#b88a57', '#a32742', '#5a081a', '#4648d4', '#005236'];

/** Plan distribution (live) + top AI consumers of the last 30 days (live). */
export function UsersSidePanel({ data }: { data: AdminUsersResponse }) {
  const total = data.distribution.reduce((s, d) => s + d.count, 0);
  return (
    <div className="flex flex-col gap-3 xl:col-span-4">
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-semibold leading-[24px] tracking-[-0.02em] text-[#1a1b22]">
              Plan Distribution
            </h2>
            <p className="text-[12px] text-[#47464b]">Live breakdown across user licenses</p>
          </div>
          <span className="material-symbols-outlined text-[20px] text-[#47464b]" aria-hidden="true">
            pie_chart
          </span>
        </div>
        {total === 0 ? (
          <p className="rounded-lg bg-[#f4f2fd] p-3 text-[13px] text-[#47464b]">
            No users yet.
          </p>
        ) : (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#eeedf7]">
              {data.distribution.map((d, i) => (
                <div
                  key={d.plan}
                  className="h-full"
                  title={`${d.plan} (${Math.round((d.count / total) * 100)}%)`}
                  style={{
                    width: `${(d.count / total) * 100}%`,
                    backgroundColor: PLAN_COLORS[i % PLAN_COLORS.length],
                  }}
                />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
              {data.distribution.map((d, i) => (
                <div
                  key={d.plan}
                  className="flex items-center justify-between rounded bg-[#f4f2fd] p-2"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: PLAN_COLORS[i % PLAN_COLORS.length] }}
                    />
                    <span className="font-medium text-[#1a1b22]">{d.plan}</span>
                  </div>
                  <span className="font-mono text-[12px] text-[#47464b]">
                    {d.count.toLocaleString('en-US')} (
                    {total === 0 ? 0 : Math.round((d.count / total) * 100)}%)
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="mt-3 flex items-center justify-between border-t border-[#e3e1ec] pt-3 text-[12px]">
          <span className="text-[#47464b]">Average revenue per account</span>
          <span className="font-mono font-semibold text-[#1a1b22]">
            {formatMoney(data.avgRevenuePerUser, 'USD')}
          </span>
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-[#4648d4]" aria-hidden="true">
                bolt
              </span>
              <h2 className="text-[18px] font-semibold leading-[24px] tracking-[-0.02em] text-[#1a1b22]">
                AI Heavy Consumers
              </h2>
            </div>
            <p className="text-[12px] text-[#47464b]">Top AI users in the past 30 days</p>
          </div>
        </div>
        {data.topAi.length === 0 ? (
          <p className="rounded-lg bg-[#f4f2fd] p-3 text-[13px] text-[#47464b]">
            No AI runs in the past 30 days.
          </p>
        ) : (
          <div className="space-y-2">
            {data.topAi.map((u, i) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-lg bg-[#f4f2fd] p-2.5 transition-colors hover:bg-[#eeedf7]"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="w-4 font-mono text-[11px] font-bold text-[#47464b]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-[13px] font-semibold text-[#1a1b22]">
                      {u.name}
                    </span>
                    <span className="truncate text-[11px] text-[#47464b]">{u.email}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-mono text-[12px] font-semibold text-[#1a1b22]">
                    {u.runs.toLocaleString('en-US')}
                  </span>
                  <span className="block text-[10px] text-[#47464b]">runs</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
