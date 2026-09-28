import React from 'react';
import { formatDateTime, formatNumber } from '@/lib/i18n/format';
import type { Locale } from '@/lib/i18n/locales';
import { operationLabel, type CreditUsageEntry } from '@/lib/billing';

const operationIcon: Record<string, string> = {
  GENERATE_DESIGN: 'auto_awesome',
  REGENERATE_DESIGN: 'refresh',
  EDIT_DESIGN: 'brush',
};

/**
 * A reservation that was refunded did not cost the user anything, so the row
 * says so instead of quietly showing a zero that looks like a bug.
 */
function statusTone(entry: CreditUsageEntry): { label: string; className: string } {
  if (entry.status === 'SUCCEEDED') {
    return { label: 'Completed', className: 'border-line bg-surface-muted text-muted' };
  }
  if (entry.status === 'PENDING') {
    return { label: 'In progress', className: 'border-line bg-surface-muted text-muted' };
  }
  return { label: 'Refunded', className: 'border-success/20 bg-success/10 text-success' };
}

function UsageRow({ entry, locale }: { entry: CreditUsageEntry; locale: Locale }) {
  const tone = statusTone(entry);
  const icon = operationIcon[entry.operationType] ?? 'auto_awesome';

  return (
    <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-accent"
          aria-hidden="true"
        >
          <span className="material-symbols-outlined text-[16px]">{icon}</span>
        </span>
        <div className="min-w-0">
          <p className="truncate text-body-md text-ink">{operationLabel(entry.operationType)}</p>
          <p className="mt-0.5 truncate text-body-sm text-muted">
            {entry.invitationTitle ?? 'Invitation removed'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 sm:justify-end sm:gap-6">
        <span
          className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${tone.className}`}
        >
          {tone.label}
        </span>
        <time
          dateTime={entry.createdAt}
          className="shrink-0 text-body-sm tabular-nums text-muted"
        >
          {formatDateTime(entry.createdAt, locale)}
        </time>
        <span className="shrink-0 text-right text-body-sm tabular-nums text-ink">
          <span className="text-muted">-</span> {formatNumber(entry.creditsConsumed, locale)}
        </span>
      </div>
    </li>
  );
}

export function UsageHistory({
  entries,
  locale,
}: {
  entries: CreditUsageEntry[];
  locale: Locale;
}) {
  if (entries.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center sm:p-12">
        <span className="material-symbols-outlined text-3xl text-accent" aria-hidden="true">
          history
        </span>
        <h3 className="mt-4 font-display text-headline-sm text-ink">No AI activity yet</h3>
        <p className="mx-auto mt-2 max-w-md text-body-md text-muted">
          Every design you generate or edit with AI will appear here with the credits it used.
        </p>
      </section>
    );
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-subtle">
      {entries.map((entry) => (
        <UsageRow key={entry.id} entry={entry} locale={locale} />
      ))}
    </ul>
  );
}
