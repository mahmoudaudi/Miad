import type { Metadata } from 'next';
import './globals.css';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { LocaleProvider } from '@/lib/i18n/LocaleProvider';

/* eslint-disable @next/next/no-page-custom-font -- App Router has no _document; hoisted <link> is the documented approach */

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary('en').meta;
  return {
    title: t.title,
    description: t.description,
    icons: { icon: '/miad-logo.png' },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body className="min-h-screen bg-background font-body-md text-ink antialiased">
        {/* Font stylesheets must live inside <body> (<link> directly under
            <html> causes a React hydration mismatch in dev). Next hoists them
            to <head> identically on server and client. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;800&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Inter:wght@100..900&family=Syne:wght@700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400..700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Pinyon+Script&display=swap"
          rel="stylesheet"
        />
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
