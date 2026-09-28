import React from 'react';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/locales';
import { getTemplates } from '@/lib/templates';
import { Reveal } from './Reveal';
import { TemplateCard } from './TemplateCard';
import { TemplateGrid } from './TemplateGrid';

export function TemplateShowcaseHeader({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).templates;
  return <Reveal><h2 className="text-[26px] font-semibold tracking-[-0.02em] text-ink sm:text-[30px]">{t.catalogTitle}</h2><p className="sr-only">{t.title} {t.blurb}</p></Reveal>;
}

export async function TemplateShowcase({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).templates;
  const catalog = await getTemplates();
  const categories = ['wedding', 'birthday', 'dinner', 'corporate'] as const;
  return (
    <section id="templates" className="scroll-mt-16 bg-[rgb(var(--section-alt))] px-4 py-10 sm:px-6 lg:px-12">
      <div className="mx-auto grid w-full max-w-[1240px] grid-cols-1 items-center gap-x-5 gap-y-8 lg:grid-cols-[minmax(280px,1fr)_auto]">
        <TemplateShowcaseHeader locale={locale} />
        <TemplateGrid
          filters={[{ value: 'all', label: t.all }, ...categories.map((category) => ({ value: category, label: t.categories[category] }))]}
          filterLabel={t.filterLabel}
          emptyMessage={t.empty}
          browseLabel={t.browseAll}
          items={catalog.map((template) => ({
            key: template.id,
            category: template.category,
            card: (
              <TemplateCard
                template={template}
                name={template.name}
                description={template.description}
                actionLabel={t.startCreating}
              />
            ),
          }))}
        />
      </div>
    </section>
  );
}
