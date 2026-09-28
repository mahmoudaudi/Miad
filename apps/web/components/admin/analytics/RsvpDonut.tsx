import React from 'react';
import type { AdminAnalytics } from '@/lib/admin';

/** RSVP disposition donut from stored response rows (attending/not/pending). */
export function RsvpDonut({ data }: { data: AdminAnalytics }) {
  const { rsvp } = data;
  const total = Math.max(1, rsvp.attending + rsvp.notAttending + rsvp.pending);
  const circumference = 2 * Math.PI * 38;
  const segments = [
    { label: 'Attending', value: rsvp.attending, color: '#7d1128' },
    { label: 'Not Attending', value: rsvp.notAttending, color: '#1b1b1e' },
    { label: 'Pending', value: rsvp.pending, color: '#c0c1ff' },
  ];
  let offset = 0;
  const arcs = segments.map((s) => {
    const len = (s.value / total) * circumference;
    const arc = { ...s, len, offset: -offset };
    offset += len;
    return arc;
  });
  const attendingRate = Math.round((rsvp.attending / total) * 1000) / 10;

  return (
    <section className="flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm lg:col-span-4">
      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold leading-[24px] tracking-[-0.02em] text-[#1a1b22]">
            RSVP Activity &amp; Guests
          </h2>
          <span className="font-mono text-[11px] text-[#47464b]">
            {data.kpis.rsvpResponses.toLocaleString('en-US')} Total
          </span>
        </div>
        <p className="text-[12px] text-[#47464b]">Response disposition &amp; expected headcounts</p>
      </div>
      <div className="flex items-center justify-center py-3">
        <div className="relative h-44 w-44">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" fill="none" r="38" stroke="#f4f2fd" strokeWidth="12" />
            {arcs.map((a) => (
              <circle
                key={a.label}
                cx="50"
                cy="50"
                fill="none"
                r="38"
                stroke={a.color}
                strokeDasharray={`${a.len.toFixed(1)} ${circumference.toFixed(1)}`}
                strokeDashoffset={a.offset.toFixed(1)}
                strokeWidth="12"
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[24px] font-semibold text-[#1a1b22]">{attendingRate}%</span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#47464b]">
              Attending
            </span>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 text-[13px]">
        {arcs.map((a) => (
          <div key={a.label} className="flex items-center justify-between rounded-lg p-1.5 transition-colors hover:bg-[#f4f2fd]">
            <span className="flex items-center gap-2 text-[#1a1b22]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: a.color }} />
              {a.label}
            </span>
            <span className="font-mono text-[12px] font-semibold">
              {a.value.toLocaleString('en-US')}
            </span>
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between rounded-lg bg-[#f4f2fd] p-2">
          <span className="text-[12px] font-semibold text-[#1a1b22]">Total Expected Guests</span>
          <span className="font-mono text-[13px] font-bold">
            {rsvp.attendingGuests.toLocaleString('en-US')}
          </span>
        </div>
      </div>
    </section>
  );
}
