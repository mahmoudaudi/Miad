import React from 'react';
import { InvitationCanvas } from '@/components/invitations/InvitationCanvas';
import { invitationDesignOptions } from '@/lib/invitation-designs';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { trackingFor, type Locale } from '@/lib/i18n/locales';
import { CONTAINER } from './theme';
import { Reveal } from './Reveal';

const romanticOption = invitationDesignOptions.find((option) => option.id === 'romantic-blush');
if (!romanticOption) throw new Error('Romantic Blush theme is required for the landing page.');
const romanticSpecification = romanticOption.specification;

/**
 * AI transformation — a static visual explanation of the product idea:
 * a natural-language prompt becomes a finished invitation website.
 * Nothing here executes; the composer above is the real entry point.
 */
export function Transformation({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).transformation;
  return (
    <section
      aria-labelledby="transformation-heading"
      className="relative overflow-hidden border-y border-line bg-[#F6F3EF] py-16 md:py-24"
    >
      <div
        aria-hidden="true"
        className="absolute -start-24 top-20 h-72 w-72 rounded-full bg-primary/[0.05] blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -end-20 bottom-0 h-80 w-80 rounded-full bg-[#D8B7A5]/20 blur-3xl"
      />

      <div className={`relative ${CONTAINER}`}>
        <Reveal className="mb-10 max-w-3xl md:mb-14">
          <span
            className={`mb-4 flex items-center gap-3 text-label-sm uppercase text-accent ${trackingFor(locale, 'tracking-wider')}`}
          >
            <span aria-hidden="true" className="h-px w-8 bg-accent/60" />
            {t.eyebrow}
          </span>
          <h2
            id="transformation-heading"
            className="max-w-2xl font-display text-headline-lg-mobile leading-[1.08] text-ink md:text-headline-lg"
          >
            {t.title}
          </h2>
        </Reveal>

        <Reveal className="rounded-[2rem] border border-black/[0.08] bg-white/80 p-3 shadow-[0_24px_80px_rgba(52,35,38,0.10)] backdrop-blur-sm sm:p-5 lg:p-6">
          <div className="grid items-stretch lg:grid-cols-[0.82fr_5rem_1.18fr]">
            <article className="relative flex min-h-[340px] flex-col overflow-hidden rounded-[1.5rem] bg-[#261C1E] p-7 text-white sm:min-h-[400px] sm:p-10">
              <div
                aria-hidden="true"
                className="absolute -end-20 -top-20 h-64 w-64 rounded-full border border-white/10"
              />
              <div
                aria-hidden="true"
                className="absolute -end-8 -top-8 h-40 w-40 rounded-full border border-white/10"
              />
              <div className="relative flex items-center justify-between gap-4">
                <p
                  className={`text-label-sm uppercase text-[#E7B9A6] ${trackingFor(locale, 'tracking-[0.16em]')}`}
                >
                  {t.wordsLabel}
                </p>
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined rounded-full border border-white/15 bg-white/[0.06] p-2 text-lg text-[#E7B9A6]"
                >
                  auto_awesome
                </span>
              </div>

              <div className="relative my-auto py-10">
                <span
                  aria-hidden="true"
                  className="block font-display text-6xl leading-none text-[#E7B9A6]/40"
                >
                  “
                </span>
                <p className="-mt-3 max-w-md font-display text-2xl leading-relaxed text-white sm:text-[1.8rem]">
                  {t.quote.replace(/^[“«]|[”»]$/g, '')}
                </p>
              </div>

              <div className="relative flex items-center gap-3 border-t border-white/10 pt-5 text-white/55">
                <span className="material-symbols-outlined text-lg" aria-hidden="true">
                  edit_note
                </span>
                <span className="h-px flex-1 bg-white/10" />
              </div>
            </article>

            <div className="relative flex min-h-24 items-center justify-center lg:min-h-0">
              <span aria-hidden="true" className="absolute h-px w-full bg-line lg:h-full lg:w-px" />
              <div className="relative flex flex-col items-center gap-2 bg-white px-3 py-2 lg:px-2 lg:py-3">
                <span
                  className={`text-[10px] font-semibold uppercase text-muted ${trackingFor(locale, 'tracking-[0.14em]')}`}
                >
                  {t.becomes}
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white shadow-[0_8px_24px_rgba(122,38,58,0.24)]">
                  <span className="lg:hidden">
                    <span className="material-symbols-outlined text-xl" aria-hidden="true">
                      arrow_downward
                    </span>
                  </span>
                  <span className="hidden lg:inline">
                    <span className="material-symbols-outlined text-xl" aria-hidden="true">
                      arrow_forward
                    </span>
                  </span>
                </span>
              </div>
            </div>

            <article className="overflow-hidden rounded-[1.5rem] border border-black/10 bg-[#EEE9E3] shadow-[0_12px_32px_rgba(52,35,38,0.08)]">
              <header className="flex min-h-14 items-center gap-4 border-b border-black/10 bg-white/90 px-5">
                <div className="flex gap-1.5" aria-hidden="true">
                  <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#D8B7A5]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#D8D2CB]" />
                </div>
                <div
                  dir="ltr"
                  className="flex min-w-0 flex-1 items-center justify-center rounded-full bg-surface-muted px-4 py-1.5 text-[11px] text-muted"
                >
                  <span className="truncate">miad.app/sarah-ahmad</span>
                </div>
                <span className="material-symbols-outlined text-lg text-muted" aria-hidden="true">
                  lock
                </span>
              </header>
              <div className="border-b border-black/10 bg-white px-5 py-3">
                <p
                  className={`text-label-sm uppercase text-accent ${trackingFor(locale, 'tracking-[0.16em]')}`}
                >
                  {t.websiteLabel}
                </p>
              </div>
              <InvitationCanvas
                specification={{ ...romanticSpecification, content: t.content }}
                className="min-h-[360px] rounded-none border-0 sm:min-h-[420px]"
              />
            </article>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
