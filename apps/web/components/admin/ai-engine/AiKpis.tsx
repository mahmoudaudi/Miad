import React from 'react';
import { AdminIcon, type AdminIconTone } from '../AdminIcon';
import type { AdminAiTelemetry } from '@/lib/admin';

function Card({
  label,
  icon,
  tone,
  value,
  valueClass,
  sub,
}: {
  label: string;
  icon: string;
  tone: AdminIconTone;
  value: React.ReactNode;
  valueClass?: string;
  sub: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#47464b]">
          {label}
        </span>
        <AdminIcon icon={icon} tone={tone} label={label} />
      </div>
      <div className="mt-2">
        <div
          className={`text-[24px] font-semibold leading-[32px] tracking-[-0.025em] ${valueClass ?? 'text-[#1a1b22]'}`}
        >
          {value}
        </div>
        <div className="mt-1 text-[11px] text-[#47464b]">{sub}</div>
      </div>
    </div>
  );
}

/** Engine KPI row — request counts, outcomes, tokens, and routing config. */
export function AiKpis({ data }: { data: AdminAiTelemetry }) {
  const { kpis } = data;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Card
        label="Total AI Requests"
        icon="memory"
        tone="indigo"
        value={kpis.total.toLocaleString('en-US')}
        sub={`${kpis.generations.toLocaleString('en-US')} Gen + ${kpis.refinements.toLocaleString('en-US')} Refine`}
      />
      <Card
        label="Successful"
        icon="verified"
        tone="green"
        value={kpis.successful.toLocaleString('en-US')}
        sub={
          <span className="rounded bg-[#eeedf7] px-1.5 py-0.5 font-mono text-[11px] font-medium">
            {kpis.successRate}% success rate
          </span>
        }
      />
      <Card
        label="Failed Requests"
        icon="error"
        tone="red"
        value={kpis.failed.toLocaleString('en-US')}
        valueClass="text-[#ba1a1a]"
        sub={
          <span className="rounded bg-[#ffdad6] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[#93000a]">
            {kpis.total === 0 ? 0 : Math.round((kpis.failed / kpis.total) * 1000) / 10}% fail rate
          </span>
        }
      />
      <Card
        label="Token Usage"
        icon="data_exploration"
        tone="amber"
        value={
          kpis.tokensTotal >= 1_000_000
            ? `${(kpis.tokensTotal / 1_000_000).toFixed(1)}M`
            : kpis.tokensTotal.toLocaleString('en-US')
        }
        sub="tokens recorded across all runs"
      />
      <Card
        label="Avg Tokens / Run"
        icon="speed"
        tone="indigo"
        value={kpis.avgTokensPerRun.toLocaleString('en-US')}
        sub="mean tokensUsed per recorded run"
      />
      <Card
        label="Routing Models"
        icon="hub"
        tone="burgundy"
        value={`${kpis.modelsAvailable}/${kpis.modelsConfigured}`}
        sub="available of configured routing models"
      />
    </div>
  );
}
