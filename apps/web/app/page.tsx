import {
  FinalCta,
  Footer,
  Header,
  Hero,
  HowItWorks,
  Pricing,
  TemplateShowcase,
  FeatureGrid,
  TrustStrip,
} from '@/components/landing';

/**
 * Miad landing page — Minimal Editorial theme.
 * English-only. All navigation, footer, CTA, and auth actions are real
 * product routes.
 */
export default function HomePage() {
  const locale = 'en' as const;
  return (
    <div className="miad-landing w-full bg-background font-body-md text-ink">
      {/* Without JavaScript the scroll-reveal stays hidden — reveal it. */}
      <noscript>
        <style>{`.reveal{opacity:1 !important;transform:none !important;}`}</style>
      </noscript>
      <a href="#main-content" className="miad-skip">
        Skip to content
      </a>
      <Header />
      <main id="main-content" tabIndex={-1} className="w-full bg-background pt-20">
        <div className="flex w-full flex-col">
          <Hero locale={locale} />
          <HowItWorks locale={locale} />
          <TemplateShowcase locale={locale} />
          <FeatureGrid locale={locale} />
          <TrustStrip locale={locale} />
          <Pricing locale={locale} />
          <FinalCta locale={locale} />
          <Footer locale={locale} />
        </div>
      </main>
    </div>
  );
}
