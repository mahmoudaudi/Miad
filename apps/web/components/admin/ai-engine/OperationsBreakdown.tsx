import React from 'react';
import type { AdminAiTelemetry } from '@/lib/admin';

function prettyOperation(operation: string): string {
  return operation
    .split('_')
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(' ');
}

/** Run volume, outcome, and token profile per recorded pipeline operation. */
export function OperationsBreakdown({ data }: { data: AdminAiTelemetry }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl bg-white p-5 shadow-sm">
      <div className="flex flex-col justify-between gap-2 border-b border-[#e3e1ec] pb-2 md:flex-row md:items-center">
        <div>
          <h2 className="text-[18px] font-semibold leading-[24px] tracking-[-0.02em] text-[#1a1b22]">
            Breakdown by Operation
          </h2>
          <p className="text-[12px] text-[#47464b]">
            Run volume, success profiles, and token allocation by pipeline stage.
          </p>
        </div>
        <span className="self-start rounded bg-[#e8e7f1] px-2 py-0.5 font-mono text-[11px] text-[#47464b] md:self-auto">
          {data.kpis.total.toLocaleString('en-US')} Total Inferences
        </span>
      </div>
      {data.operations.length === 0 ? (
        <p className="rounded-lg bg-[#f4f2fd] p-4 text-center text-[13px] text-[#47464b]">
          No recorded operations yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {data.operations.map((op, i) => (
            <div
              key={op.operation}
              className="flex flex-col justify-between gap-2 rounded-lg border border-[#e3e1ec] bg-[#f4f2fd]/50 p-2.5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[13px] font-semibold text-[#1a1b22]">
                    {prettyOperation(op.operation)}
                  </div>
                  <div className="font-mono text-[11px] text-[#47464b]">
                    {op.runs.toLocaleString('en-US')} runs
                  </div>
                </div>
                <span
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                    i === 0 ? 'bg-[#e1e0ff] text-[#07006c]' : 'bg-[#e8e7f1] text-[#47464b]'
                  }`}
                >
                  {op.share}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#e8e7f1]">
                <div
                  className="h-full rounded-full bg-[#7d1128]"
                  style={{ width: `${Math.min(100, op.share)}%` }}
                />
              </div>
              <div className="flex items-center justify-between font-mono text-[11px] text-[#47464b]">
                <span>{op.successRate}% success</span>
                <span className="font-semibold text-[#1a1b22]">
                  {op.avgTokens.toLocaleString('en-US')} tok avg
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
