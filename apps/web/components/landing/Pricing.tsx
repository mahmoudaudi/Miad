import Link from 'next/link';
import React from 'react';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { trackingFor, type Locale } from '@/lib/i18n/locales';
import { BTN_PRIMARY, BTN_SECONDARY, CONTAINER } from './theme';
import { Reveal } from './Reveal';

/** Pricing preview — every plan starts with a real account (checkout comes later). */
export function Pricing({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).pricing;
  return (
    <section id="pricing" className="scroll-mt-16 bg-surface py-16 md:py-24">
      <div className={CONTAINER}>
        <Reveal className="mx-auto mb-12 max-w-2xl text-center md:mb-16">
          <span
            className={`mb-3 block text-label-sm uppercase text-accent ${trackingFor(locale, 'tracking-wider')}`}
          >
            {t.eyebrow}
          </span>
          <h2 className="mb-4 font-display text-headline-lg-mobile text-ink md:text-headline-lg">
            {t.title}
          </h2>
          <p className="text-body-lg text-muted">{t.subtitle}</p>
        </Reveal>
        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3">
          {t.tiers.map((tier) => (
            <div
              key={tier.name}
              className={
                tier.featured
                  ? 'relative flex flex-col justify-between rounded-2xl bg-ink p-6 text-white shadow-lift sm:p-8'
                  : 'flex flex-col justify-between rounded-2xl border border-line bg-background p-6 sm:p-8'
              }
            >
              {tier.featured && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-label-sm font-semibold text-white">
                  {t.popular}
                </div>
              )}
              <div>
                <div
                  className={`mb-2 text-label-sm uppercase tracking-wider ${tier.featured ? 'text-white/70' : 'text-muted'}`}
                >
                  {tier.name}
                </div>
                <div
                  className={`mb-4 font-display text-4xl ${tier.featured ? 'text-white' : 'text-ink'}`}
                >
                  {tier.price}{' '}
                  <span
                    className={`font-body-md text-body-md ${tier.featured ? 'text-white/70' : 'text-muted'}`}
                  >
                    {t.perMonth}
                  </span>
                </div>
                <p
                  className={`mb-8 text-body-md ${tier.featured ? 'text-white/70' : 'text-muted'}`}
                >
                  {tier.blurb}
                </p>
                <ul
                  className={`mb-8 space-y-4 text-body-md ${tier.featured ? 'text-white' : 'text-ink'}`}
                >
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3">
                      <span
                        className="material-symbols-outlined text-sm text-accent"
                        aria-hidden="true"
                      >
                        check
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                href="/register"
                className={`block w-full rounded-xl py-3 text-center font-title text-label-md ${
                  tier.featured
                    ? 'bg-surface text-ink transition-all hover:bg-white/90'
                    : tier.ctaStyle === 'secondary'
                      ? BTN_SECONDARY
                      : BTN_PRIMARY
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
