import Link from 'next/link';
import React from 'react';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/locales';
import { CONTAINER } from './theme';
import { Reveal } from './Reveal';

/** Final CTA — the page's closing statement with the real signup route. */
export function FinalCta({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).finalCta;
  return (
    <section aria-labelledby="final-cta-heading" className="bg-background py-20 md:py-28">
      <div className={CONTAINER}>
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2
            id="final-cta-heading"
            className="mb-4 font-display text-headline-lg-mobile text-ink md:text-headline-lg"
          >
            {t.title}
          </h2>
          <p className="mb-9 text-body-lg text-muted">{t.subtitle}</p>
          <Link
            href="/register"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 font-title text-label-md text-white transition-all hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:w-auto"
          >
            {t.button}
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              arrow_forward
            </span>
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
