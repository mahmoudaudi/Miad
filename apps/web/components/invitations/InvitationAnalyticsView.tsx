import type { InvitationAnalytics } from '@/lib/analytics';

export function InvitationAnalyticsView({ analytics }: { analytics: InvitationAnalytics }) {
  const metrics = [
    ['Views', analytics.views],
    ['Unique visitors', analytics.uniqueVisitors],
    ['RSVP responses', analytics.rsvps],
    ['Attending', analytics.attending],
    ['Not attending', analytics.notAttending],
    ['Pending', analytics.pending],
    ['Guests attending', analytics.attendingGuests],
  ];
  return (
    <section aria-labelledby="analytics-heading" className="mt-6 rounded-2xl border border-line bg-surface p-6 shadow-subtle sm:p-9">
      <h2 id="analytics-heading" className="font-display text-headline-md text-ink">Analytics</h2>
      <dl className="mt-6 grid gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-background p-4">
            <dt className="text-label-sm text-muted">{label}</dt>
            <dd className="mt-2 text-2xl font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
