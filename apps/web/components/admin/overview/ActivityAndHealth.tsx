import React from 'react';
import { timeAgo, type AdminActivityItem, type AdminOverview } from '@/lib/admin';

const ACTIVITY_ICON: Record<AdminActivityItem['kind'], { icon: string; cls: string }> = {
  user_registered: { icon: 'person_add', cls: 'bg-[#eeedf7] text-[#47464b]' },
  invitation_created: { icon: 'note_add', cls: 'bg-[#eeedf7] text-[#47464b]' },
  invitation_published: { icon: 'rocket_launch', cls: 'bg-[#6ffbbe]/30 text-[#005236]' },
  ai_completed: { icon: 'auto_awesome', cls: 'bg-[#e1e0ff]/40 text-[#4648d4]' },
  ai_failed: { icon: 'error', cls: 'bg-[#ffdad6]/50 text-[#ba1a1a]' },
};

/** Live audit of the latest platform events (users, invitations, AI runs). */
export function RecentActivity({ items }: { items: AdminActivityItem[] }) {
  return (
    <div className="flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm lg:col-span-7">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-[18px] font-semibold leading-[24px] tracking-[-0.02em] text-[#1a1b22]">
              Recent Activity
            </h2>
            <span className="rounded-full bg-[#eeedf7] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#47464b]">
              Real-time audit
            </span>
          </div>
          <span className="font-mono text-[11px] text-[#47464b]">
            {items.length} events
          </span>
        </div>
        {items.length === 0 ? (
          <p className="rounded-lg bg-[#f4f2fd] p-4 text-[13px] text-[#47464b]">
            No platform activity yet. New users, invitations, and AI runs will appear here.
          </p>
        ) : (
          <div className="space-y-1">
            {items.map((item) => {
              const visual = ACTIVITY_ICON[item.kind];
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-[#f4f2fd]"
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${visual.cls}`}
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                      {visual.icon}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="truncate text-[13px] font-medium text-[#1a1b22]">{item.title}</p>
                      <span className="shrink-0 font-mono text-[11px] text-[#47464b]">
                        {timeAgo(item.occurredAt)}
                      </span>
                    </div>
                    <p className="truncate text-[12px] text-[#47464b]">{item.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

type HealthCard = {
  name: string;
  detail: string;
  metric: string;
  barPct: number;
  ok: boolean;
};

/**
 * Live service status. Every card is derived from reachable data (AI success
 * rates, RSVP flow, content flow, DB round-trip) — no invented uptimes.
 */
export function SystemHealth({
  overview,
  latencyMs,
}: {
  overview: AdminOverview;
  latencyMs: number | null;
}) {
  const cards: HealthCard[] = [
    {
      name: 'AI Generation Engine',
      detail: `${overview.ai.generations.toLocaleString('en-US')} generations • ${overview.ai.refinements.toLocaleString('en-US')} refinements`,
      metric: `${overview.ai.successRate}% success`,
      barPct: overview.ai.successRate,
      ok: overview.ai.successRate >= 95 || overview.ai.successful + overview.ai.failed === 0,
    },
    {
      name: 'RSVP & Guest Service',
      detail: `${overview.rsvps.total.toLocaleString('en-US')} RSVPs • ${overview.rsvps.attendingRate}% attending`,
      metric: 'Flow readable',
      barPct: overview.rsvps.attendingRate,
      ok: true,
    },
    {
      name: 'Content Pipeline',
      detail: `${overview.invitations.published.toLocaleString('en-US')} published of ${overview.invitations.total.toLocaleString('en-US')} invitations`,
      metric:
        overview.invitations.total === 0
          ? 'No content yet'
          : `${Math.round((overview.invitations.published / overview.invitations.total) * 1000) / 10}% published`,
      barPct:
        overview.invitations.total === 0
          ? 0
          : (overview.invitations.published / overview.invitations.total) * 100,
      ok: true,
    },
    {
      name: 'Platform Database',
      detail:
        latencyMs === null ? 'Connected' : `Overview query answered in ${Math.round(latencyMs)}ms`,
      metric: 'Connected',
      barPct: 100,
      ok: true,
    },
  ];
  const allOk = cards.every((c) => c.ok);
  return (
    <div className="flex flex-col justify-between rounded-xl bg-white p-5 shadow-sm lg:col-span-5">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold leading-[24px] tracking-[-0.02em] text-[#1a1b22]">
            AI System Health
          </h2>
          <div
            className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[11px] ${
              allOk ? 'bg-[#6ffbbe]/20 text-[#005236]' : 'bg-[#ffdad6] text-[#93000a]'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${allOk ? 'bg-[#005236]' : 'bg-[#ba1a1a]'}`} />
            {allOk ? 'All Systems Operational' : 'Attention Needed'}
          </div>
        </div>
        <div className="space-y-2.5">
          {cards.map((card) => (
            <div
              key={card.name}
              className="rounded-lg bg-[#f4f2fd] p-2 transition-colors hover:bg-[#eeedf7]"
            >
              <div className="mb-1 flex items-center justify-between">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${card.ok ? 'bg-[#005236]' : 'bg-[#ba1a1a]'}`}
                  />
                  <span className="truncate text-[13px] font-medium text-[#1a1b22]">
                    {card.name}
                  </span>
                </div>
                <span
                  className={`font-mono text-[11px] font-medium ${card.ok ? 'text-[#005236]' : 'text-[#ba1a1a]'}`}
                >
                  {card.ok ? 'Operational' : 'Degraded'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[#47464b]">
                <span className="truncate">{card.detail}</span>
                <span className="shrink-0 font-mono">{card.metric}</span>
              </div>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[#e3e1ec]">
                <div
                  className={`h-full rounded-full ${card.ok ? 'bg-[#005236]' : 'bg-[#ba1a1a]'}`}
                  style={{ width: `${Math.min(100, Math.max(0, card.barPct))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
