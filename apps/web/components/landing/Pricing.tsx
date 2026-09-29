'use client';

import React, { useEffect, useState } from 'react';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { trackingFor, type Locale } from '@/lib/i18n/locales';
import { AuthModalTrigger } from './AuthModalTrigger';
import { BTN_PRIMARY, CONTAINER } from './theme';
import { Reveal } from './Reveal';
import { getBillingPlans, type BillingPlan } from '@/lib/billing';
import { formatCurrency, formatNumber } from '@/lib/i18n/format';
import { getBillingCurrency } from '@/lib/env';

type PricingPlan = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  billingInterval: string;
  creditsPerCycle: number | null;
  features: string[];
  featured: boolean;
};

function mapPlan(plan: BillingPlan): PricingPlan {
  const features = plan.planFeatures
    .filter((f) => f.feature.name !== 'AI_CREDITS_PER_CYCLE' && f.enabled)
    .map((f) => f.feature.name);
  return {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    price: Number(plan.price),
    billingInterval: plan.billingInterval,
    creditsPerCycle: plan.creditsPerCycle,
    features,
    featured: Number(plan.price) > 0 && Number(plan.price) <= 10,
  };
}

function SkeletonCard() {
  return (
    <div className="flex flex-col rounded-2xl border border-line bg-background p-6 sm:p-8">
      <div className="mb-2 h-4 w-20 animate-pulse rounded bg-line" />
      <div className="mb-4 h-10 w-28 animate-pulse rounded bg-line" />
      <div className="mb-8 h-4 w-full animate-pulse rounded bg-line" />
      <div className="mb-8 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 w-full animate-pulse rounded bg-line" />
        ))}
      </div>
      <div className="mt-auto h-11 w-full animate-pulse rounded-xl bg-line" />
    </div>
  );
}

export function Pricing({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).pricing;
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBillingPlans()
      .then((data) => {
        if (cancelled) return;
        setPlans(
          data
            .filter((p) => p.name !== 'Premium')
            .sort((a, b) => Number(a.price) - Number(b.price))
            .map((p) => mapPlan(p))
        );
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
        {error ? (
          <p className="text-center text-body-md text-muted">Unable to load pricing. Please try again later.</p>
        ) : loading ? (
          <div className="mx-auto grid max-w-5xl grid-cols-1 items-stretch gap-6 sm:grid-cols-2 md:grid-cols-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <div className="mx-auto grid max-w-5xl grid-cols-1 items-stretch gap-6 sm:grid-cols-2 md:grid-cols-3">
            {plans.map((plan) => (
              <PricingTierCard key={plan.id} plan={plan} locale={locale} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function PricingTierCard({
  plan,
  locale,
  action,
}: {
  plan: PricingPlan;
  locale: Locale;
  action?: React.ReactNode;
}) {
  const t = getDictionary(locale).pricing;
  const amount = plan.price;
  const isFree = amount === 0;
  const intervalLabel = /year|annual/i.test(plan.billingInterval)
    ? 'per year'
    : 'per month';

  return (
    <article
      data-pricing-tier={plan.name.toLowerCase()}
      className={
        plan.featured
          ? 'relative flex flex-col justify-between rounded-2xl bg-ink p-6 text-background shadow-lift sm:p-8'
          : 'flex flex-col justify-between rounded-2xl border border-line bg-background p-6 sm:p-8'
      }
    >
      {plan.featured && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-label-sm font-semibold text-background">
          {t.popular}
        </div>
      )}
      <div>
        <div
          className={`mb-2 text-label-sm uppercase tracking-wider ${plan.featured ? 'text-background/70' : 'text-muted'}`}
        >
          {plan.name}
        </div>
        <div
          className={`mb-4 font-display text-4xl ${plan.featured ? 'text-background' : 'text-ink'}`}
        >
          {isFree ? 'Free' : formatCurrency(amount, locale, getBillingCurrency())}{' '}
          {!isFree && (
            <span
              className={`font-body-md text-body-md ${plan.featured ? 'text-background/70' : 'text-muted'}`}
            >
              {intervalLabel}
            </span>
          )}
        </div>
        {plan.description && (
          <p className={`mb-8 text-body-md ${plan.featured ? 'text-background/70' : 'text-muted'}`}>
            {plan.description}
          </p>
        )}
        {plan.creditsPerCycle !== null && (
          <p
            className={`mb-4 flex items-center gap-2 text-body-md ${plan.featured ? 'text-background' : 'text-ink'}`}
          >
            <span className="material-symbols-outlined text-[16px] text-accent" aria-hidden="true">
              bolt
            </span>
            <span>
              {formatNumber(plan.creditsPerCycle, locale)}{' '}
              {plan.creditsPerCycle === 1 ? 'credit' : 'credits'} included
              {!isFree && ` ${intervalLabel}`}
            </span>
          </p>
        )}
        {plan.features.length > 0 && (
          <ul
            className={`mb-8 space-y-4 text-body-md ${plan.featured ? 'text-background' : 'text-ink'}`}
          >
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-center gap-3">
                <span className="material-symbols-outlined text-sm text-accent" aria-hidden="true">
                  check
                </span>
                {feature}
              </li>
            ))}
          </ul>
        )}
      </div>
      {action ?? (
        <AuthModalTrigger
          mode="register"
          className={`block w-full rounded-xl py-3 text-center font-title text-label-md ${
            plan.featured
              ? 'bg-surface text-ink transition-all hover:bg-[rgb(var(--tint-soft))]'
              : BTN_PRIMARY
          } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}
        >
          {isFree ? t.tiers[0]?.cta ?? 'Get Started' : t.tiers[1]?.cta ?? 'Start Trial'}
        </AuthModalTrigger>
      )}
    </article>
  );
}
