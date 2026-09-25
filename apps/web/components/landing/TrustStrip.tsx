import React from 'react';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/locales';
import { CONTAINER } from './theme';

/**
 * Trust strip — honest product assurances only. No counts, no testimonials,
 * no statistics: none of those exist in the application data.
 */
export function TrustStrip({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).trust;
  return (
    <section aria-label={t.label} className="border-y border-line bg-surface py-10">
      <div
        className={`${CONTAINER} flex flex-col items-center justify-center gap-4 text-center text-body-md text-muted sm:flex-row sm:gap-10`}
      >
        {t.lines.map((line, index) => (
          <React.Fragment key={line}>
            {index > 0 && (
              <span aria-hidden="true" className="hidden h-1 w-1 rounded-full bg-line sm:block" />
            )}
            <span>{line}</span>
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}
