import Link from 'next/link';
import React from 'react';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { formatNumber } from '@/lib/i18n/format';
import type { Locale } from '@/lib/i18n/locales';
import { AuthModalTrigger } from './AuthModalTrigger';
import { CONTAINER } from './theme';

/** Footer — dark editorial band. */
export function Footer({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const columns = [
    {
      heading: t.footer.product,
      links: [
        { label: t.nav.howItWorks, href: '/#how-it-works' },
        { label: t.nav.templates, href: '/#templates' },
        { label: t.nav.pricing, href: '/#pricing' },
      ],
    },
    {
      heading: t.footer.account,
      links: [
        { label: t.auth.login, href: '/login' },
        { label: t.auth.createAccount, href: '/register' },
        { label: t.nav.dashboard, href: '/dashboard/invitations/new' },
      ],
    },
  ];
  return (
    <footer className="bg-ink pb-12 pt-16 text-background">
      <div className={`${CONTAINER} mb-16 grid grid-cols-1 gap-12 md:grid-cols-4`}>
        <div className="md:col-span-2">
          <div className="mb-4 font-display text-2xl">Miad</div>
          <p className="mb-6 max-w-sm text-body-md text-background/60">{t.footer.tagline}</p>
        </div>
        {columns.map((column) => (
          <nav key={column.heading} aria-label={`Footer — ${column.heading}`}>
            <h2 className="mb-4 font-title text-title">{column.heading}</h2>
            <ul className="space-y-3 text-body-md text-background/60">
              {column.links.map((link) => (
                <li key={link.label}>
                  {link.href === '/login' || link.href === '/register' ? (
                    <AuthModalTrigger
                      mode={link.href === '/login' ? 'login' : 'register'}
                      className="transition-colors hover:text-background"
                    >
                      {link.label}
                    </AuthModalTrigger>
                  ) : (
                    <Link className="transition-colors hover:text-background" href={link.href}>
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div
        className={`${CONTAINER} flex flex-col items-center justify-between border-t border-background/10 pt-8 text-body-sm text-background/50 sm:flex-row`}
      >
        <div>
          © {formatNumber(2025, locale)} {t.footer.brand} {t.footer.rights}
        </div>
      </div>
    </footer>
  );
}
