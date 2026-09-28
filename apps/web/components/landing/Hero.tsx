import React from 'react';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/locales';
import { Meteors } from '@/components/ui/meteors';
import { CONTAINER } from './theme';
import { PromptBox } from './PromptBox';
import { Reveal } from './Reveal';

/** Hero — AI-first headline with the prompt composer as the primary CTA. */
export function Hero({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).hero;
  return (
    <section className="relative w-full overflow-hidden bg-background pb-12 pt-10 sm:pt-16 md:pb-20 md:pt-20">
      {/* Decorative sky sits behind the content and never intercepts input. */}
      <Meteors number={18} />
      <div className={`${CONTAINER} relative z-10 flex flex-col items-center text-center`}>
        <Reveal>
          <h1 className="mb-5 max-w-4xl text-balance font-display text-display-mobile text-ink md:text-display">
            {t.title}
          </h1>
        </Reveal>
        <Reveal>
          <p className="mb-10 max-w-2xl text-body-lg text-muted">{t.subtitle}</p>
        </Reveal>
        <PromptBox />
      </div>
    </section>
  );
}
