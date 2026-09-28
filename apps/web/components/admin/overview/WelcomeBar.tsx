import React from 'react';

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Overview control bar: real admin name, real date, live-data pill and a
 * working CSV export of the loaded generations page.
 */
export function WelcomeBar({
  firstName,
  canExport,
  onExport,
}: {
  firstName: string;
  canExport: boolean;
  onExport: () => void;
}) {
  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  return (
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-[24px] font-semibold leading-[32px] tracking-[-0.025em] text-[#1a1b22]">
            {greetingForHour(now.getHours())}, {firstName}
          </h1>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e8e7f1] px-2 py-0.5 font-mono text-[11px] text-[#47464b]">
            <span className="material-symbols-outlined text-[13px] text-[#4648d4]" aria-hidden="true">
              schedule
            </span>
            {dateLabel}
          </span>
        </div>
        <p className="text-[13px] leading-[20px] text-[#47464b]">
          Here&apos;s what&apos;s happening across your platform today.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onExport}
          disabled={!canExport}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#7d1128] px-3 py-1.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-[#670e21] disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            file_download
          </span>
          Export Report
        </button>
      </div>
    </div>
  );
}
