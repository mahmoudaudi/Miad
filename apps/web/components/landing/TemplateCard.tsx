import Link from 'next/link';
import React from 'react';
import type { TemplateRecord } from '@/lib/templates';

export type TemplatePreview =
  | 'deep-orange'
  | 'audio-matrix'
  | 'spring-care'
  | 'dinner-party'
  | 'altitude'
  | 'jazz-night'
  | 'omakase'
  | 'silent-earth';

function DeepOrange() {
  return (
    <>
      <div className="relative z-10 px-6 pt-6 text-center">
        <h3 className="font-cinzel text-sm font-bold uppercase tracking-[0.28em] text-white sm:text-base">
          Deep Orange
        </h3>
        <div className="mt-2 h-px w-full bg-white/35" />
      </div>
      <div className="relative mt-auto flex h-[65%] w-full items-end justify-center overflow-hidden">
        <div className="relative -mb-5 h-44 w-44 -rotate-12 rounded-t-full bg-gradient-to-t from-black via-[#7d1203] to-[#d6260d] shadow-2xl transition-transform duration-500 group-hover:scale-105">
          <div className="absolute left-3 top-12 flex gap-2">
            <span className="h-6 w-11 -skew-x-6 rounded-lg border border-red-950/40 bg-black shadow-inner" />
            <span className="h-6 w-11 -skew-x-6 rounded-lg border border-red-950/40 bg-black shadow-inner" />
          </div>
          <div className="absolute -bottom-2 left-1/2 h-16 w-32 -translate-x-1/2 rounded-t-3xl bg-[#160301]" />
        </div>
        <span className="pointer-events-none absolute -bottom-4 select-none font-serif text-[72px] font-bold text-white/10">
          MUSE
        </span>
      </div>
    </>
  );
}

function AudioMatrix() {
  const cells = [20, 30, 100, 90, 80, 100, 40, 20, 30, 100, 100, 90, 80, 90, 30, 10];
  return (
    <div className="flex h-full flex-col justify-between p-3.5">
      <div className="space-y-2">
        <div className="flex items-center justify-between border-b border-neutral-800/80 pb-1.5">
          <div className="flex gap-1.5">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="h-1.5 w-1.5 rounded-full bg-neutral-700 first:bg-neutral-600"
              />
            ))}
          </div>
          <span className="font-mono text-[9px] text-neutral-500">dsp-synth.v2</span>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1 text-[9px]">
          <div className="rounded border border-neutral-800/70 bg-[#14171d] p-1.5">
            <span className="block text-[8px] text-neutral-500">FREQ SPECTRUM</span>
            <div className="flex h-6 items-end gap-0.5 pt-1">
              {[2, 3, 5, 4, 2].map((height, index) => (
                <span
                  key={index}
                  className="w-1 rounded-sm bg-emerald-400"
                  style={{ height: `${height * 3}px` }}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-between rounded border border-neutral-800/70 bg-[#14171d] p-1.5">
            <span className="text-[8px] text-neutral-500">PATCH MATRIX</span>
            <div className="flex items-center gap-1.5">
              <span className="flex h-3 w-3 items-center justify-center rounded-full border border-emerald-500/60">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="font-mono text-[8px] text-emerald-400">96.4 kHz</span>
            </div>
          </div>
        </div>
      </div>
      <div className="my-auto grid grid-cols-8 gap-1 rounded border border-emerald-950/40 bg-[#12161b] p-2">
        {cells.map((opacity, index) => (
          <span
            key={index}
            className="h-2.5 rounded-sm bg-emerald-400"
            style={{
              opacity: opacity / 100,
              boxShadow: opacity === 100 ? '0 0 8px rgba(52,211,153,.7)' : undefined,
            }}
          />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1.5 border-t border-neutral-800/80 pt-1">
        {['#6366f1', '#a855f7', '#3b82f6', '#10b981'].map((color, index) => (
          <span
            key={color}
            className="flex h-3.5 items-center rounded border border-neutral-800 bg-neutral-900 px-1"
          >
            <span
              className="h-1.5 rounded-full"
              style={{ width: `${100 - index * 10}%`, background: color, opacity: 0.7 }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

function SpringCare() {
  return (
    <div className="flex h-full flex-col justify-between p-3.5 font-inter">
      <div>
        <div className="mb-2 flex items-center justify-between border-b border-neutral-100 pb-1.5 text-[9px] text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded bg-orange-500" />
            <b className="text-neutral-600">Overview</b>
            <span>Patients</span>
            <span>Services</span>
          </div>
          <span className="rounded bg-neutral-100 px-1 font-mono text-[8px] text-neutral-600">
            v1.4
          </span>
        </div>
        <div className="grid grid-cols-12 items-stretch gap-1.5">
          <div className="col-span-7 flex flex-col justify-between rounded-lg bg-[#ff5a1f] p-2.5 text-white">
            <div>
              <span className="block text-[8px] font-semibold uppercase tracking-wider opacity-85">
                Special Campaign
              </span>
              <h3 className="mt-0.5 text-xs font-bold leading-snug sm:text-sm">
                Spring Care — 40%
              </h3>
            </div>
            <span className="mt-2 w-fit rounded bg-white/20 px-1.5 py-0.5 text-[8px] font-medium">
              Activate offer
            </span>
          </div>
          <div className="col-span-3 flex flex-col justify-between rounded-lg border border-neutral-100 bg-neutral-50 p-2">
            <span className="text-[8px] text-neutral-400">Total Visits</span>
            <b className="text-base leading-tight text-neutral-900">248</b>
            <span className="text-[7px] font-semibold text-emerald-600">↑ 12.4%</span>
          </div>
          <div className="col-span-2 flex flex-col justify-between rounded-lg bg-[#17191d] p-2 text-white">
            <span className="text-[8px] text-neutral-400">Pending</span>
            <b className="text-sm leading-tight">27</b>
            <span className="text-[7px] text-neutral-400">31% cap</span>
          </div>
        </div>
      </div>
      <div className="space-y-1 border-t border-neutral-100 pt-2">
        <div className="flex justify-between px-1 text-[8px] text-neutral-400">
          <span>Patient / Client</span>
          <span>Treatment</span>
          <span>Status</span>
        </div>
        {[
          ['Eleanor Vance', 'Cardio Check', 'Completed'],
          ['Marcus Sterling', 'Dental Polish', 'Pending'],
        ].map((row) => (
          <div
            key={row[0]}
            className="flex items-center justify-between rounded bg-neutral-50/70 p-1 text-[8.5px]"
          >
            <b className="text-neutral-700">{row[0]}</b>
            <span className="text-neutral-500">{row[1]}</span>
            <span
              className={`rounded-full px-1 text-[7.5px] font-medium ${row[2] === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'}`}
            >
              {row[2]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DinnerParty() {
  return (
    <div className="h-full p-4">
      <div className="flex h-full flex-col justify-between rounded border border-[#2b4c39]/30 p-2.5">
        <div className="space-y-1 text-center font-serif">
          <div className="text-[7px] uppercase tracking-[0.25em] text-[#3f634d]">
            Exclusive Gathering • Nine Courses
          </div>
          <h3 className="text-base font-bold uppercase leading-tight tracking-[0.08em] text-[#1b3425] sm:text-lg">
            The Dinner Party
          </h3>
          <div className="mx-auto h-px w-12 bg-[#2b4c39]/40" />
          <p className="text-[7.5px] uppercase tracking-[0.14em] text-[#476a54]">
            A Thrilling Preview of Nine Courses
          </p>
        </div>
        <div className="relative flex h-24 w-full flex-col items-center justify-end overflow-hidden rounded border border-[#2b4c39]/20 bg-[#dfe6d9] p-2">
          <div className="mb-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#2b4c39] bg-[#faf8f4] shadow-sm">
            <span className="h-px w-1.5 -rotate-45 bg-[#2b4c39]" />
          </div>
          <div className="flex w-full items-end justify-between px-3">
            {[0, 1].map((side) => (
              <div
                key={side}
                className={`flex h-14 w-5 flex-col justify-between rounded-t-sm border border-[#1b3527] bg-[#234331] p-0.5 ${side ? 'order-3' : ''}`}
              >
                <span className="h-4 border border-[#3b624b]" />
                <span className="h-6 border border-[#3b624b]" />
              </div>
            ))}
            <div className="mx-2 flex flex-1 flex-col items-center">
              <span className="h-1.5 w-14 rounded-t-full bg-[#1a3324]" />
              <span className="flex h-3 w-16 items-center justify-around rounded-sm bg-[#244633] px-1">
                {[0, 1, 2].map((dot) => (
                  <i key={dot} className="h-1 w-1 rounded-full bg-amber-200/80" />
                ))}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Altitude() {
  return (
    <div className="relative flex h-full flex-col justify-between p-4">
      <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-600/10 blur-2xl" />
      <div className="flex items-start justify-between border-b border-neutral-800/80 pb-2 font-mono text-[8px] tracking-wider text-neutral-400">
        <span>ALTITUDE HABITAT</span>
        <span className="text-amber-500/80">FIELD SUITE 01.35</span>
      </div>
      <div className="relative my-auto rounded-lg border border-neutral-700/50 bg-neutral-900/80 p-3 backdrop-blur">
        <span className="absolute -top-2 left-3 rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[7px] text-neutral-400">
          PANEL REF
        </span>
        <h3 className="text-sm font-light leading-snug tracking-tight text-neutral-100">
          Sleep above
          <br />
          <span className="font-normal text-amber-200/90">the weather</span>
        </h3>
        <p className="mt-1 line-clamp-2 text-[8px] text-neutral-400">
          Engineered atmospheric sleeping capsules suspended at cloud line elevation.
        </p>
      </div>
      <div className="flex items-end justify-between border-t border-neutral-800/70 pt-1 text-[9px]">
        <div>
          <span className="font-serif text-sm text-amber-400/90">01</span>
          <span className="block text-[7.5px] text-neutral-500">Atmospheric Series</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="font-mono text-[7px] text-neutral-400">LIVE DENSITY</span>
        </div>
      </div>
    </div>
  );
}

function JazzNight() {
  return (
    <div className="h-full p-3 font-syne">
      <div className="relative flex h-full flex-col justify-between border-[6px] border-black bg-[#fbf9f4] p-2">
        <div className="template-checker mb-1 h-2 w-full" />
        <div className="relative my-auto py-1 text-center">
          <h3 className="-rotate-1 text-3xl font-black uppercase leading-none tracking-tighter sm:text-4xl">
            JAZZ
          </h3>
          <div className="mt-1 rotate-1 text-2xl font-black uppercase tracking-tight sm:text-3xl">
            NIGHT
          </div>
          <div className="relative mx-auto mt-2 flex h-8 w-28 items-center justify-center">
            <span className="h-6 w-12 rounded-full border-2 border-dashed border-black" />
            <span className="absolute right-2 top-3 h-0.5 w-8 rotate-12 bg-black" />
          </div>
        </div>
        <div className="flex items-end justify-between border-t-2 border-black pt-1 text-[8px] font-bold tracking-widest">
          <span className="flex flex-col font-mono text-[7px] leading-tight">
            TRI
            <br />
            CAN
          </span>
          <span className="font-sans text-[7.5px] tracking-normal">8:00 PM • DOWNTOWN CLUB</span>
          <span className="font-mono">VOL.04</span>
        </div>
      </div>
    </div>
  );
}

function Omakase() {
  return (
    <div className="relative flex h-full flex-col justify-between overflow-hidden p-4 font-cormorant">
      <div className="flex items-start justify-between">
        <span className="font-sans text-[8px] uppercase tracking-[0.2em] text-neutral-400">
          KAI • 廻
        </span>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#b83b26] font-sans text-[7px] font-bold text-white shadow-sm">
          旬
        </span>
        <span className="font-sans text-[8px] text-neutral-400">TOKYO • NYC</span>
      </div>
      <div className="pointer-events-none absolute inset-0">
        <span className="absolute left-10 top-5 h-4 w-9 -rotate-12 rounded-full border-b-2 border-white/40 bg-gradient-to-r from-[#ba2d24] to-[#d63d33] shadow-md" />
        <span className="absolute right-8 top-7 h-4 w-10 rotate-12 rounded-full border-b-2 border-white/40 bg-gradient-to-r from-[#f07b46] to-[#ff945e] shadow-md" />
        <span className="absolute bottom-10 left-12 h-2.5 w-8 rotate-45 rounded-full bg-amber-100 opacity-80" />
        <span className="absolute bottom-4 right-14 h-7 w-6 -rotate-6 rounded-sm border border-neutral-800/10 bg-amber-400/90" />
      </div>
      <div className="z-10 my-auto pt-2 text-center">
        <h3 className="text-lg font-normal leading-tight text-neutral-800 sm:text-xl">
          <span className="block italic">Intimate.</span>
          <span className="block">Chef-led.</span>
          <span className="block tracking-wide">Omakase.</span>
        </h3>
        <p className="mt-2 font-sans text-[7.5px] uppercase tracking-[0.18em] text-neutral-400">
          Sixteen Courses • Daily Catch
        </p>
      </div>
      <div className="z-10 text-center font-sans text-[7px] uppercase tracking-widest text-neutral-400">
        Reservations Open First of Month
      </div>
    </div>
  );
}

function SilentEarth() {
  return (
    <div className="flex h-full flex-col justify-between p-3.5 font-inter">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-1.5 text-[7.5px] text-neutral-400">
        <span className="font-serif font-medium uppercase tracking-widest text-white">
          Elias Vance
        </span>
        <div className="flex gap-2">
          <span>Portfolio</span>
          <span>Archive</span>
          <span>Exhibition</span>
        </div>
      </div>
      <div className="my-auto grid grid-cols-12 items-center gap-2">
        <div className="col-span-5 space-y-1">
          <h3 className="font-serif text-sm font-normal leading-tight text-white sm:text-base">
            The
            <br />
            Silent
            <br />
            Earth.
          </h3>
          <p className="line-clamp-3 text-[7px] leading-relaxed text-neutral-400">
            A study in desolate solitudes and the towering presence of untamed alpine peaks.
          </p>
        </div>
        <div className="relative col-span-4 flex h-24 items-center justify-center overflow-hidden rounded border border-neutral-700/60 bg-gradient-to-b from-neutral-800 via-neutral-900 to-black shadow-inner">
          <span className="absolute bottom-0 h-16 w-full rounded-t-full bg-neutral-700/40 blur-[1px]" />
          <span className="absolute bottom-0 h-12 w-3/4 rounded-t-full bg-neutral-600/30 blur-[2px]" />
          <span className="absolute bottom-0 h-8 w-1/2 rounded-t-md bg-neutral-900" />
          <span className="absolute bottom-1 font-serif text-[7px] italic text-neutral-400">
            Yosemite Valley
          </span>
        </div>
        <div className="col-span-3 rotate-2 rounded-sm border border-neutral-300 bg-white p-1 pb-2 shadow-md">
          <div className="flex h-14 items-center justify-center overflow-hidden bg-neutral-800">
            <span className="h-8 w-2 rounded-t-full bg-neutral-300 opacity-60" />
          </div>
          <span className="mt-1 block text-center font-mono text-[6px] text-neutral-700">
            No. 08/24
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-neutral-900 pt-1 text-[7px] text-neutral-500">
        <span>Solo Gallery Exhibition</span>
        <span>Tokyo • Fall 2024</span>
      </div>
    </div>
  );
}

const previews: Record<TemplatePreview, React.ComponentType> = {
  'deep-orange': DeepOrange,
  'audio-matrix': AudioMatrix,
  'spring-care': SpringCare,
  'dinner-party': DinnerParty,
  altitude: Altitude,
  'jazz-night': JazzNight,
  omakase: Omakase,
  'silent-earth': SilentEarth,
};
const previewClasses: Record<TemplatePreview, string> = {
  'deep-orange': 'bg-[#e02b11]',
  'audio-matrix': 'border border-neutral-800 bg-[#0d0f12] text-neutral-300',
  'spring-care': 'border border-neutral-200/80 bg-white text-neutral-800',
  'dinner-party': 'border border-[#d8ded0] bg-[#eef1e9] text-[#1e3427]',
  altitude: 'border border-neutral-800 bg-[#18191c] text-white',
  'jazz-night': 'border border-neutral-300 bg-[#faf7ef] text-black',
  omakase: 'border border-neutral-200/90 bg-[#fbfaf8] text-neutral-900',
  'silent-earth': 'border border-neutral-800 bg-[#101114] text-neutral-200',
};

const catalogPreviewMap: Record<string, TemplatePreview> = {
  'deep-orange': 'deep-orange',
  'audio-matrix': 'audio-matrix',
  'spring-care': 'spring-care',
  'dinner-party': 'dinner-party',
  altitude: 'altitude',
  'jazz-night': 'jazz-night',
  omakase: 'omakase',
  'silent-earth': 'silent-earth',
  'classic-ivory': 'dinner-party',
  'modern-contrast': 'audio-matrix',
  'romantic-blush': 'omakase',
};

type VisualTemplateCardProps = { preview: TemplatePreview; label: string; actionLabel: string };
type CatalogTemplateCardProps = {
  template: TemplateRecord;
  name: string;
  description?: string;
  actionLabel: string;
};
type TemplateCardProps = VisualTemplateCardProps | CatalogTemplateCardProps;

/** A compact, fully-clickable visual preview matching the supplied catalog reference. */
export function TemplateCard(props: TemplateCardProps) {
  const preview =
    'preview' in props ? props.preview : (catalogPreviewMap[props.template.slug] ?? 'deep-orange');
  const label = 'label' in props ? props.label : props.name;
  const { actionLabel } = props;
  const Preview = previews[preview];
  return (
    <Link
      href="/register"
      aria-label={`${actionLabel}: ${label}`}
      className="group min-w-0 overflow-hidden rounded-xl border border-line bg-surface shadow-subtle transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <div
        aria-hidden="true"
        className={`relative aspect-[4/3] overflow-hidden ${previewClasses[preview]}`}
      >
        <Preview />
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="truncate text-sm font-medium text-ink">{label}</span>
        <span className="material-symbols-outlined text-lg text-primary" aria-hidden="true">
          arrow_outward
        </span>
      </div>
    </Link>
  );
}
