import React from 'react';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { trackingFor, type Locale } from '@/lib/i18n/locales';
import { CONTAINER } from './theme';
import { Reveal } from './Reveal';

function EditorVisual() {
  return (
    <div className="relative mx-auto flex h-48 w-full max-w-[290px] items-end justify-center">
      <div className="absolute start-0 top-6 w-3/4 -rotate-3 rounded-2xl border border-line bg-surface-muted p-4 shadow-subtle transition-transform duration-300 group-hover:-rotate-1">
        <div className="flex items-baseline gap-3 border-b border-line pb-3">
          <span className="font-display text-xl text-ink">Aa</span>
          <span className="text-xs font-semibold text-muted">Aa</span>
          <span className="text-[10px] text-muted">Aa</span>
        </div>
        <div className="mt-3 flex gap-2">
          <span className="h-6 flex-1 rounded-md bg-[#F0E3DC]" />
          <span className="h-6 flex-1 rounded-md bg-[#D8B7A5]" />
          <span className="h-6 flex-1 rounded-md bg-primary" />
        </div>
      </div>
      <div className="absolute bottom-0 end-0 w-4/5 rotate-2 rounded-2xl border border-line bg-white p-4 shadow-lift transition-transform duration-300 group-hover:rotate-0">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-2 w-20 rounded-full bg-ink/80" />
          <span className="material-symbols-outlined text-lg text-accent" aria-hidden="true">
            tune
          </span>
        </div>
        <div className="space-y-2">
          <div className="h-2 w-full rounded-full bg-line" />
          <div className="h-2 w-4/5 rounded-full bg-line" />
          <div className="mt-4 h-8 rounded-lg bg-primary" />
        </div>
      </div>
    </div>
  );
}

function AttendanceVisual() {
  return (
    <div className="flex h-48 items-center justify-center">
      <div className="w-full max-w-[280px] rounded-[1.4rem] border border-line bg-[#FAF8F5] p-4 shadow-subtle transition-transform duration-300 group-hover:-translate-y-1">
        <div className="mb-4 flex items-center justify-between">
          <div className="space-y-1.5">
            <div className="h-2 w-20 rounded-full bg-ink/80" />
            <div className="h-1.5 w-28 rounded-full bg-line" />
          </div>
          <span className="material-symbols-outlined text-xl text-primary" aria-hidden="true">
            event_available
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {['check', 'question_mark', 'close'].map((icon, index) => (
            <div
              key={icon}
              className={`flex h-16 items-center justify-center rounded-xl border ${
                index === 0
                  ? 'border-primary bg-primary text-white shadow-subtle'
                  : 'border-line bg-white text-muted'
              }`}
            >
              <span className="material-symbols-outlined text-xl" aria-hidden="true">
                {icon}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 h-8 rounded-lg border border-line bg-white" />
      </div>
    </div>
  );
}

function GuestsVisual() {
  return (
    <div className="flex h-48 items-center justify-center">
      <div className="relative w-full max-w-[280px]">
        <div className="absolute bottom-6 start-7 top-6 w-px bg-line" aria-hidden="true" />
        {['person', 'person_2', 'person_3'].map((icon, index) => (
          <div
            key={icon}
            className="relative mb-2 flex items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-subtle transition-transform duration-300 group-hover:translate-x-1"
          >
            <span className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F0E8E3] text-primary">
              <span className="material-symbols-outlined text-lg" aria-hidden="true">
                {icon}
              </span>
            </span>
            <span className="min-w-0 flex-1 space-y-2">
              <span className="block h-2 w-2/3 rounded-full bg-ink/80" />
              <span className="block h-1.5 w-1/2 rounded-full bg-line" />
            </span>
            <span
              className={`h-2.5 w-2.5 rounded-full ${index === 1 ? 'bg-[#D8B7A5]' : 'bg-primary'}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function PhotosVisual() {
  const photos = [
    '/landing/template-wedding.jpg',
    '/landing/template-dinner.jpg',
    '/landing/template-birthday.jpg',
  ];
  return (
    <div className="mx-auto grid h-48 w-full max-w-[290px] grid-cols-3 items-center gap-2 overflow-hidden rounded-2xl">
      {photos.map((photo, index) => (
        <div
          key={photo}
          aria-hidden="true"
          className={`bg-cover bg-center transition-transform duration-500 group-hover:scale-[1.03] ${
            index === 1 ? 'h-48 rounded-2xl' : 'h-36 rounded-xl'
          }`}
          style={{ backgroundImage: `url(${photo})` }}
        />
      ))}
    </div>
  );
}

function LinksVisual() {
  return (
    <div className="flex h-48 flex-col items-center justify-center">
      <div className="relative mb-5 flex items-center justify-center">
        <span className="absolute h-px w-44 bg-line" aria-hidden="true" />
        <span className="relative flex h-20 w-20 items-center justify-center rounded-full border border-line bg-white text-primary shadow-lift transition-transform duration-300 group-hover:scale-105">
          <span className="material-symbols-outlined text-3xl" aria-hidden="true">
            link
          </span>
        </span>
        <span className="absolute -start-20 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface-muted text-muted shadow-subtle">
          <span className="material-symbols-outlined text-lg" aria-hidden="true">
            public
          </span>
        </span>
        <span className="absolute -end-20 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface-muted text-muted shadow-subtle">
          <span className="material-symbols-outlined text-lg" aria-hidden="true">
            send
          </span>
        </span>
      </div>
      <div
        dir="ltr"
        className="rounded-full border border-line bg-[#F8F6F2] px-5 py-2 text-xs text-muted"
      >
        miad.app/your-event
      </div>
    </div>
  );
}

function NotificationsVisual() {
  return (
    <div className="flex h-48 items-center justify-center">
      <div className="relative w-full max-w-[285px] pt-8">
        {[2, 1, 0].map((offset) => (
          <div
            key={offset}
            className="absolute inset-x-0 flex items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-subtle transition-transform duration-300 group-hover:-translate-y-1"
            style={{
              top: `${offset * 25}px`,
              opacity: 1 - offset * 0.2,
              scale: `${1 - offset * 0.04}`,
            }}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
              <span className="material-symbols-outlined text-xl" aria-hidden="true">
                {offset === 0 ? 'notifications_active' : 'mark_email_read'}
              </span>
            </span>
            <span className="min-w-0 flex-1 space-y-2">
              <span className="block h-2 w-3/4 rounded-full bg-ink/80" />
              <span className="block h-1.5 w-full rounded-full bg-line" />
            </span>
            <span className="h-2 w-2 rounded-full bg-primary" />
          </div>
        ))}
      </div>
    </div>
  );
}

const FEATURE_VISUALS = [
  EditorVisual,
  AttendanceVisual,
  GuestsVisual,
  PhotosVisual,
  LinksVisual,
  NotificationsVisual,
] as const;

const FEATURE_ICONS = [
  'palette',
  'event_available',
  'groups',
  'photo_library',
  'link',
  'notifications',
] as const;

/** Feature bento — only capabilities that exist in the product today. */
export function FeatureGrid({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).features;
  return (
    <section aria-labelledby="features-heading" className="bg-[#FAF9F7] py-16 md:py-24">
      <div className={CONTAINER}>
        <Reveal className="mx-auto mb-12 max-w-3xl text-center md:mb-14">
          <span
            className={`mb-4 inline-flex items-center gap-2 rounded-full border border-[#D8B7A5]/60 bg-secondary px-3 py-1.5 text-label-sm uppercase text-primary ${trackingFor(locale, 'tracking-wider')}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
            {t.eyebrow}
          </span>
          <h2
            id="features-heading"
            className="font-display text-headline-lg-mobile leading-[1.08] text-ink md:text-headline-lg"
          >
            {t.title}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-body-lg text-muted">{t.subtitle}</p>
        </Reveal>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {t.items.map((feature, index) => {
            const Visual = FEATURE_VISUALS[index] ?? EditorVisual;
            return (
              <Reveal key={feature.title} className="h-full">
                <article className="group flex h-full min-h-[390px] flex-col justify-between overflow-hidden rounded-[1.75rem] border border-black/[0.08] bg-white p-7 shadow-subtle transition-all duration-300 hover:-translate-y-1 hover:border-black/15 hover:shadow-lift sm:p-8">
                  <header className="relative z-10">
                    <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl border border-[#D8B7A5]/50 bg-secondary text-primary">
                      <span className="material-symbols-outlined text-xl" aria-hidden="true">
                        {FEATURE_ICONS[index] ?? 'auto_awesome'}
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold tracking-[-0.02em] text-ink">
                      {feature.title}
                    </h3>
                    <p className="mt-2 max-w-sm text-body-md leading-relaxed text-muted">
                      {feature.text}
                    </p>
                  </header>
                  <div className="mt-7" aria-hidden="true">
                    <Visual />
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
