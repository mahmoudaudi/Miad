import React from 'react';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { trackingFor, type Locale } from '@/lib/i18n/locales';
import { CONTAINER } from './theme';
import { Reveal } from './Reveal';

function StepGraphic({ index, label }: { index: number; label: string }) {
  if (index === 0) {
    return (
      <div
        className="relative my-6 flex h-[250px] w-full items-center justify-center md:h-[270px]"
        aria-hidden="true"
      >
        <div className="absolute h-[210px] w-[210px] rounded-full border border-dashed border-primary/70" />
        <div className="absolute left-2 top-2 z-10 rounded-lg border border-neutral-800 bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-800 shadow-sm">
          {label}
        </div>
        <div className="absolute right-0 top-[42%] z-10 flex translate-x-1 items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-white shadow-sm">
          <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
            edit
          </span>
          <span className="text-xs font-semibold tracking-wide">Start</span>
        </div>
        <div className="absolute bottom-3 left-0 z-10 flex items-center gap-1.5 rounded-lg border border-neutral-800 bg-white px-3 py-1.5 shadow-sm">
          <span
            className="material-symbols-outlined text-[16px] text-neutral-800"
            aria-hidden="true"
          >
            person
          </span>
          <span className="text-xs font-semibold text-neutral-800">Host</span>
        </div>
      </div>
    );
  }

  if (index === 1) {
    return (
      <div
        className="relative my-6 flex h-[250px] w-full items-center justify-center md:h-[270px]"
        aria-hidden="true"
      >
        <div className="flex w-[185px] flex-col gap-2 rounded-[26px] border-2 border-primary bg-transparent p-2">
          {['Copy', 'Design', 'Layout', 'Confirm Attendance'].map((item) => (
            <div
              key={item}
              className="w-full rounded-xl border border-neutral-800/80 bg-[#E5DFD7] px-3 py-2 text-center shadow-sm"
            >
              <span className="text-[12px] font-medium text-neutral-900">{item}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative my-6 flex h-[250px] w-full items-center justify-center md:h-[270px]"
      aria-hidden="true"
    >
      <svg className="absolute inset-0 h-full w-full" fill="none" viewBox="0 0 240 240">
        <path
          d="M 48 126 C 78 126, 86 136, 106 136"
          stroke="#333"
          strokeDasharray="2 3"
          strokeWidth="1.3"
        />
        <path
          d="M 120 110 C 120 84, 136 74, 162 74"
          stroke="#333"
          strokeDasharray="2 3"
          strokeWidth="1.3"
        />
        <path
          d="M 126 150 C 126 170, 142 181, 166 181"
          stroke="#333"
          strokeDasharray="2 3"
          strokeWidth="1.3"
        />
      </svg>
      <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-md">
        <span className="material-symbols-outlined text-[30px]" aria-hidden="true">
          ios_share
        </span>
      </div>
      <div className="absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-6 items-center justify-center rounded-xl bg-white shadow-sm">
        <span className="material-symbols-outlined text-[18px] text-neutral-900" aria-hidden="true">
          mail
        </span>
      </div>
      <div className="absolute right-9 top-10 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white p-1.5 shadow-sm">
        <span className="material-symbols-outlined text-[18px] text-neutral-900" aria-hidden="true">
          public
        </span>
      </div>
      <div className="absolute bottom-10 right-9 z-10 flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm">
        <span className="material-symbols-outlined text-[18px] text-neutral-900" aria-hidden="true">
          group
        </span>
      </div>
    </div>
  );
}

/** How Miad Works — three-step timeline workflow. */
export function HowItWorks({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).howItWorks;
  const cardStyles = [
    'border border-black/10 bg-white text-neutral-900 shadow-[0_4px_24px_rgba(0,0,0,0.03)]',
    'bg-[#DDD6CE] text-neutral-900',
    'bg-[#F5B495] text-neutral-950',
  ] as const;

  return (
    <section id="how-it-works" className="scroll-mt-16 bg-[#F8F6F2] py-10 md:py-14">
      <div className={CONTAINER}>
        <Reveal className="mx-auto mb-8 max-w-2xl text-center md:mb-10">
          <span
            className={`mb-3 block text-[13px] font-semibold uppercase text-neutral-800 ${trackingFor(locale, 'tracking-wide')}`}
          >
            {t.eyebrow}
          </span>
          <h2 className="font-display text-[2.15rem] font-bold leading-[1.12] tracking-[-0.03em] text-neutral-950 md:text-[3rem]">
            {t.title}
          </h2>
        </Reveal>
        <ol className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-3 xl:gap-5">
          {t.steps.map((step, index) => (
            <li
              key={step.number}
              className={`flex min-h-[440px] flex-col justify-between rounded-[28px] p-6 transition-transform duration-300 hover:-translate-y-1 md:min-h-[500px] xl:min-h-[520px] xl:p-8 ${cardStyles[index] ?? cardStyles[0]}`}
            >
              <header>
                <span className="mb-3 block text-[13px] font-semibold tracking-wide text-neutral-900/80">
                  {step.number}
                </span>
                <h3 className="text-[2.15rem] font-bold leading-[1.12] tracking-[-0.03em] text-neutral-950">
                  {step.title}
                </h3>
              </header>
              <StepGraphic index={index} label={step.title} />
              <footer>
                <p className="text-[13.5px] font-normal leading-relaxed text-neutral-800">
                  {step.text}
                </p>
              </footer>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
