import React from 'react';
import { timeAgo, type AdminAiTelemetry } from '@/lib/admin';

/** Latest successful runs with invitation links and token counts (no mock assets). */
export function RecentOutputs({ data }: { data: AdminAiTelemetry }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-semibold leading-[24px] tracking-[-0.02em] text-[#1a1b22]">
            Recent Successful Outputs
          </h2>
          <p className="text-[12px] text-[#47464b]">
            Latest resolved runs with their invitations and token usage.
          </p>
        </div>
        <span className="font-mono text-[11px] text-[#47464b]">
          {data.recentOutputs.length} latest
        </span>
      </div>
      {data.recentOutputs.length === 0 ? (
        <p className="rounded-xl bg-white p-4 text-center text-[13px] text-[#47464b] shadow-sm">
          No successful runs yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.recentOutputs.map((output) => (
            <div
              key={output.id}
              className="group flex flex-col gap-1 rounded-xl bg-white p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-semibold text-[#1a1b22]">
                  {output.title}
                </span>
                <span className="shrink-0 font-mono text-[10px] font-semibold text-[#005236]">
                  Resolved
                </span>
              </div>
              <span className="truncate text-[11px] text-[#47464b]">
                {output.operation
                  .split('_')
                  .map((w) => w[0] + w.slice(1).toLowerCase())
                  .join(' ')}{' '}
                • {output.tokensUsed === null ? 'tokens n/a' : `${output.tokensUsed.toLocaleString('en-US')} tok`} •{' '}
                {timeAgo(output.createdAt)}
              </span>
              <a
                href={`/invite/${encodeURIComponent(output.slug)}`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-[#4648d4] hover:underline"
              >
                /invite/{output.slug}
                <span className="material-symbols-outlined text-[12px]" aria-hidden="true">
                  open_in_new
                </span>
              </a>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
