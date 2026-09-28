import React from 'react';
import { initialsOf, timeAgo, type AdminAiTelemetry } from '@/lib/admin';

/**
 * Failed runs feed. The SaaS stores no error messages, models, or retry
 * states per run, so the table shows exactly what exists: when, what, who,
 * which operation, and tokens.
 */
export function FailuresTable({
  data,
  onPage,
}: {
  data: AdminAiTelemetry;
  onPage: (page: number) => void;
}) {
  const { failures } = data;
  const from = failures.total === 0 ? 0 : (failures.page - 1) * failures.limit + 1;
  const to = Math.min(
    failures.total,
    (failures.page - 1) * failures.limit + failures.items.length
  );
  return (
    <section className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm">
      <div className="flex flex-col justify-between gap-2 p-5 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[18px] font-semibold leading-[24px] tracking-[-0.02em] text-[#1a1b22]">
              Failure Logs &amp; Diagnostics
            </h2>
            {failures.total > 0 ? (
              <span className="rounded-full bg-[#ffdad6] px-2 py-0.5 font-mono text-[10px] font-semibold text-[#93000a]">
                {failures.total.toLocaleString('en-US')} Failed
              </span>
            ) : null}
          </div>
          <p className="text-[12px] text-[#47464b]">
            Every recorded FAILED run — timestamp, invitation, owner, and operation.
          </p>
        </div>
      </div>
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-[#f4f2fd]/70 font-mono text-[10px] uppercase tracking-wider text-[#47464b]">
              <th className="px-5 py-2.5 font-medium">Timestamp</th>
              <th className="px-3 py-2.5 font-medium">Invitation</th>
              <th className="px-3 py-2.5 font-medium">User</th>
              <th className="px-3 py-2.5 font-medium">Operation</th>
              <th className="px-3 py-2.5 font-medium">Tokens</th>
              <th className="px-5 py-2.5 text-right font-medium">Preview</th>
            </tr>
          </thead>
          <tbody className="text-[13px] text-[#1a1b22]">
            {failures.items.map((item) => (
              <tr key={item.id} className="bg-[#ffdad6]/10 transition-colors hover:bg-[#ffdad6]/20">
                <td className="whitespace-nowrap px-5 py-3 font-mono text-[11px] text-[#47464b]">
                  {new Date(item.createdAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  <span className="block text-[10px] text-[#47464b]/70">{timeAgo(item.createdAt)}</span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-col">
                    <span className="max-w-xs truncate text-[13px] font-medium">{item.title}</span>
                    <span className="truncate font-mono text-[11px] text-[#47464b]">
                      /invite/{item.slug}
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e8e7f1] text-[10px] font-semibold"
                    >
                      {initialsOf(item.userEmail)}
                    </span>
                    <span className="text-[12px]">{item.userEmail}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  <span className="rounded bg-[#ffdad6] px-2 py-0.5 font-mono text-[11px] font-medium text-[#93000a]">
                    {item.operation
                      .split('_')
                      .map((w) => w[0] + w.slice(1).toLowerCase())
                      .join(' ')}
                  </span>
                </td>
                <td className="px-3 py-3 font-mono text-[11px] text-[#47464b]">
                  {item.tokensUsed === null ? '—' : item.tokensUsed.toLocaleString('en-US')}
                </td>
                <td className="whitespace-nowrap px-5 py-3 text-right">
                  <a
                    href={`/invite/${encodeURIComponent(item.slug)}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Preview invitation"
                    className="inline-flex rounded p-1 text-[#47464b] transition-colors hover:bg-[#eeedf7] hover:text-[#1a1b22]"
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                      open_in_new
                    </span>
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {failures.items.length === 0 ? (
          <p className="m-3 rounded-lg bg-[#6ffbbe]/20 p-4 text-center text-[13px] font-medium text-[#005236]">
            No failed runs recorded. The pipeline is clean.
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-between bg-[#f4f2fd]/40 px-5 py-2.5 font-mono text-[11px] text-[#47464b]">
        <span>
          Showing {from}–{to} of {failures.total.toLocaleString('en-US')} failures
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={failures.page <= 1}
            onClick={() => onPage(failures.page - 1)}
            className="rounded bg-[#eeedf7] px-2 py-1 text-[#1a1b22] hover:bg-[#e8e7f1] disabled:opacity-40"
          >
            Previous
          </button>
          <span className="font-semibold text-[#1a1b22]">
            Page {failures.page} of {failures.totalPages}
          </span>
          <button
            type="button"
            disabled={failures.page >= failures.totalPages}
            onClick={() => onPage(failures.page + 1)}
            className="rounded bg-[#eeedf7] px-2 py-1 text-[#1a1b22] hover:bg-[#e8e7f1] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
