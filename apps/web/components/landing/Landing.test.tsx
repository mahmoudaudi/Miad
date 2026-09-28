import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { getDictionary } from '@/lib/i18n/dictionaries';
import type { Locale } from '@/lib/i18n/locales';
import { LocaleProvider } from '@/lib/i18n/LocaleProvider';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { AuthModal } from './AuthModal';
import { FinalCta } from './FinalCta';
import { Footer } from './Footer';
import { Hero } from './Hero';
import { HeaderView, NAV_LINK_DEFS } from './Header';
import { HowItWorks } from './HowItWorks';
import { Pricing } from './Pricing';
import { TemplateShowcaseHeader } from './TemplateShowcase';
import { TemplateGrid } from './TemplateGrid';
import { TemplateGridSkeleton } from './TemplateGridSkeleton';
import { TemplateCard } from './TemplateCard';
import { Transformation } from './Transformation';
import { TrustStrip } from './TrustStrip';
import { FeatureGrid } from './FeatureGrid';

// Static rendering has no app router — stub navigation for client islands.
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: () => undefined,
    replace: () => undefined,
    refresh: () => undefined,
  }),
  usePathname: () => '/',
}));

function hrefs(html: string): string[] {
  return Array.from(html.matchAll(/href="([^"]*)"/g), (match) => match[1] ?? '');
}

const noop = () => undefined;
const headerUser = {
  id: 'user-1',
  email: 'nadia@example.com',
  firstName: 'Nadia',
  lastName: 'Host',
  role: 'user',
  isActive: true,
};

function renderAuthModal(props: React.ComponentProps<typeof AuthModal>) {
  return renderToStaticMarkup(
    <ToastProvider>
      <AuthModal {...props} />
    </ToastProvider>
  );
}

function renderHeader(
  locale: Locale,
  props: Partial<React.ComponentProps<typeof HeaderView>> = {}
) {
  return renderToStaticMarkup(
    <LocaleProvider initialLocale={locale}>
      <HeaderView
        locale={locale}
        user={null}
        authStatus="anonymous"
        authError={null}
        loggingOut={false}
        menuOpen={false}
        scrolled={false}
        activeKey="templates"
        onMenuChange={noop}
        onAuthOpen={noop}
        onAuthRetry={noop}
        onLogout={noop}
        {...props}
      />
    </LocaleProvider>
  );
}

describe('landing navigation data', () => {
  it('points every navbar link at a real route or section anchor', () => {
    expect(NAV_LINK_DEFS.length).toBeGreaterThan(0);
    for (const link of NAV_LINK_DEFS) {
      expect(link.href).not.toBe('#');
      expect(link.href.startsWith('/') || link.href.startsWith('/#')).toBe(true);
    }
    expect(NAV_LINK_DEFS.map((link) => link.href)).toEqual([
      '/#templates',
      '/#features-heading',
      '/#pricing',
    ]);
  });

  it('labels every navbar link in English', () => {
    const labels = NAV_LINK_DEFS.map((link) => getDictionary('en').nav[link.key]);
    expect(labels).toEqual(['Templates', 'Features', 'Enterprise']);
  });

});

describe('landing navbar', () => {
  it('renders desktop navigation, logo, and anonymous actions (English-only)', () => {
    const html = renderHeader('en');
    expect(html).toContain('aria-label="Miad home"');
    expect(html).toContain('/#templates');
    expect(html).toContain('/#features-heading');
    expect(html).toContain('/#pricing');
    expect(html).not.toContain('Create Invitation');
    expect(html).toContain('Log in');
    expect(html).toContain('Sign up');
    expect(html).toContain('Miad');
    expect(html).not.toContain('aria-label="Language"');
    expect(html).not.toContain('href="#"');
  });

  it('renders the mobile menu when open with accessible controls', () => {
    const html = renderHeader('en', { menuOpen: true });
    expect(html).toContain('id="landing-mobile-menu"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-label="Close menu"');
    expect(html).toContain('Mobile navigation');
    expect(html).toContain('/#features-heading');
    expect(html).toContain('/#pricing');
    expect(html).toContain('Sign up');
    expect(html).toContain('miad-nav-menu-enter');
  });

  it('keeps the mobile menu closed when requested', () => {
    const html = renderHeader('en', { menuOpen: false });
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('id="landing-mobile-menu"');
  });

  it('renders authenticated actions without extra auth prompts', () => {
    const html = renderHeader('en', { authStatus: 'authenticated', user: headerUser });
    expect(html).toContain('Account: Nadia Host');
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('href="/dashboard/invitations/new"');
    expect(html).not.toContain('Welcome back');
  });

  it('marks active navigation in English LTR only', () => {
    const ltr = renderHeader('en', { activeKey: 'templates' });
    expect(ltr).toContain('dir="ltr"');
    expect(ltr).toContain('aria-current="page"');
    expect(ltr).toContain('Templates');

    const features = renderHeader('en', { activeKey: 'features', menuOpen: true });
    expect(features).toContain('dir="ltr"');
    expect(features).toContain('Features');
    expect(features).toContain('aria-current="page"');
    expect(features).not.toContain('dir="rtl"');

    const enterprise = renderHeader('en', { activeKey: 'enterprise' });
    expect(enterprise).toContain('Enterprise');
    expect(enterprise).toContain('aria-current="page"');
  });
});

describe('landing auth modal', () => {
  it('shows the Miad logo with the correct mode title and Google entry point', () => {
    for (const mode of ['login', 'register'] as const) {
      const html = renderAuthModal({
        mode,
        locale: 'en',
        onModeChange: noop,
        onClose: noop,
        onSuccess: noop,
      });
      expect(html).toContain('%2Fmiad-logo.png');
      expect(html).toContain('role="dialog"');
      expect(html).toMatch(/Google/i);
      expect(html).not.toMatch(/oauth|recaptcha|captcha|privacy|terms/i);
      expect(html).not.toContain('href="#"');
    }
    const loginEn = renderAuthModal({
      mode: 'login',
      locale: 'en',
      onModeChange: noop,
      onClose: noop,
      onSuccess: noop,
    });
    expect(loginEn).toContain('Welcome back');
  });

  it('offers both modes with accessible switching', () => {
    const html = renderAuthModal({
      mode: 'login',
      locale: 'en',
      onModeChange: noop,
      onClose: noop,
      onSuccess: noop,
    });
    expect(html).toContain('Log in');
    expect(html).toContain('Sign up');
    expect(html).toContain('aria-pressed');
    expect(html).toContain('aria-label="Close"');
  });

  it('shows the saved-prompt confirmation above account creation', () => {
    const notice = 'We saved your prompt! Create an account to start building.';
    const html = renderAuthModal({
      mode: 'register',
      locale: 'en',
      notice,
      onModeChange: noop,
      onClose: noop,
      onSuccess: noop,
    });
    expect(html).toContain(notice);
    expect(html).toContain('role="status"');
    expect(html.indexOf(notice)).toBeLessThan(html.indexOf('Create your account'));
  });
});

describe('landing footer', () => {
  it('has no dead links and only real destinations', () => {
    const footerHtml = renderToStaticMarkup(<Footer locale="en" />);
    const footerLinks = hrefs(footerHtml);
    expect(footerLinks.length).toBeGreaterThan(0);
    for (const href of footerLinks) {
      expect(href).not.toBe('#');
      expect(href.startsWith('/') || href.startsWith('/#')).toBe(true);
    }
    const html = renderToStaticMarkup(<Footer locale="en" />);
    const links = hrefs(html);
    expect(links).toContain('/dashboard/invitations/new');
    expect(links).toContain('/#templates');
    expect(links).toContain('/#pricing');
    expect(html).toContain('data-auth-mode="login"');
    expect(html).toContain('data-auth-mode="register"');
  });

  it('renders headings without fake social or legal links', () => {
    const html = renderToStaticMarkup(<Footer locale="en" />);
    expect(html).toContain('Product');
    expect(html).toContain('Account');
    expect(html).toContain('Log in');
    expect(html).not.toMatch(/twitter|github|linkedin|discord|privacy|terms/i);
  });
});

describe('landing pricing', () => {
  it('sends every CTA to account creation with no dead buttons', () => {
    const html = renderToStaticMarkup(<Pricing locale="en" />);
    expect(html).not.toContain('href="#"');
    expect(html.match(/data-auth-mode="register"/g)).toHaveLength(3);
    expect(html).toContain('id="pricing"');
  });
});

describe('landing template showcase', () => {
  it('renders the header with honest links and no invented statistics', () => {
    const html = renderToStaticMarkup(<TemplateShowcaseHeader locale="en" />);
    expect(html).not.toContain('href="#"');
    expect(html).not.toContain('RSVP Rate');
    expect(html).not.toContain('Live AI');
    expect(html).not.toContain('lh3.googleusercontent.com');
    expect(html).toContain('Start with an idea. AI creates the experience.');
  });

  it('shows a loading skeleton while the catalog resolves', () => {
    const html = renderToStaticMarkup(<TemplateGridSkeleton loadingLabel="Loading templates…" />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Loading templates…');
  });

  it('filters real catalog cards by occasion with accessible pills', () => {
    const items = [
      {
        key: 'a',
        category: 'wedding',
        card: (
          <TemplateCard
            template={{
              id: 'a',
              slug: 'classic-ivory',
              name: 'Classic Ivory',
              description: 'Warm ivory.',
              category: 'wedding',
              specification: {
                schemaVersion: 1,
                theme: 'classic-ivory',
                content: {
                  eyebrow: 'You are invited',
                  title: 'A Beautiful Occasion',
                  dateLine: 'Saturday',
                  venueLine: 'The Garden Room',
                },
                colors: {
                  background: '#FFFDF8',
                  surface: '#FFFFFF',
                  text: '#241C18',
                  accent: '#8B7355',
                },
                typography: { headingFamily: 'Playfair Display', bodyFamily: 'Inter' },
                layout: { alignment: 'center', density: 'airy' },
              },
              createdAt: '2026-09-23T00:00:00.000Z',
            }}
            name="Classic Ivory"
            description="Warm ivory."
            actionLabel="Start creating"
          />
        ),
      },
      {
        key: 'b',
        category: 'corporate',
        card: <span>Corporate card</span>,
      },
    ];
    const html = renderToStaticMarkup(
      <TemplateGrid
        filters={[
          { value: 'all', label: 'Featured' },
          { value: 'wedding', label: 'Wedding' },
          { value: 'corporate', label: 'Corporate' },
        ]}
        filterLabel="Filter templates by occasion"
        items={items}
        emptyMessage="No templates in this category yet."
      />
    );
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('Classic Ivory');
    expect(html).toContain('Corporate card');
    expect(html).toContain('aria-label="Filter templates by occasion"');
  });

  it('renders an honest empty state when a filter matches nothing', () => {
    const html = renderToStaticMarkup(
      <TemplateGrid filters={[]} filterLabel="Filter" items={[]} emptyMessage="Nothing here yet." />
    );
    expect(html).toContain('Nothing here yet.');
    expect(html).toContain('role="status"');
  });

  it('renders supplied theme names and descriptions', () => {
    const card = renderToStaticMarkup(
      <TemplateCard
        template={{
          id: 'a',
          slug: 'romantic-blush',
          name: 'Romantic Blush',
          description: 'Soft blush tones.',
          category: 'wedding',
          specification: {
            schemaVersion: 1,
            theme: 'romantic-blush',
            content: {
              eyebrow: 'You are invited',
              title: 'A Beautiful Occasion',
              dateLine: 'Saturday',
              venueLine: 'The Garden Room',
            },
            colors: {
              background: '#FFF7F8',
              surface: '#FFFFFF',
              text: '#3A2026',
              accent: '#A45C6A',
            },
            typography: { headingFamily: 'Playfair Display', bodyFamily: 'Inter' },
            layout: { alignment: 'center', density: 'airy' },
          },
          createdAt: '2026-09-23T00:00:00.000Z',
        }}
        name="Romantic Blush"
        description="Soft blush tones."
        actionLabel="Start creating"
      />
    );
    expect(card).toContain('Romantic Blush');
    expect(card).toContain('data-auth-mode="register"');
  });

  it('anchors the workflow section for navbar navigation', () => {
    expect(renderToStaticMarkup(<HowItWorks locale="en" />)).toContain('id="how-it-works"');
  });
});

describe('landing honesty', () => {
  it('describes only real capabilities and invents no social proof', () => {
    const features = renderToStaticMarkup(<FeatureGrid locale="en" />);
    expect(features).not.toMatch(/analytics|testimonials|\d+%|\d+,\d+|percent/i);
    const trust = renderToStaticMarkup(<TrustStrip locale="en" />);
    expect(trust).not.toMatch(/\d+%|\d+,\d+|testimonial|review/i);
    expect(features).not.toContain('>Reviews<');
    expect(features).toContain('Confirm Attendance Online');
    expect(features).toContain('Guest management');
    expect(features).toContain('Shareable links');
  });

  it('closes with a real signup CTA', () => {
    const html = renderToStaticMarkup(<FinalCta locale="en" />);
    expect(html).toContain('data-auth-mode="register"');
    expect(html).toContain('Your invitation starts with an idea.');
  });

  it('explains the transformation without fake behavior', () => {
    const html = renderToStaticMarkup(<Transformation locale="en" />);
    expect(html).not.toContain('<button');
    expect(html).toContain('Sarah &amp; Ahmad');
    expect(html).toContain('Your website');
  });

  it('renders the pricing auth actions without dead links', () => {
    const countTags = (html: string, tag: string) =>
      html.match(new RegExp(`<${tag}[ >]`, 'g'))?.length ?? 0;
    const html = renderToStaticMarkup(<Pricing locale="en" />);
    expect(countTags(html, 'a')).toBe(0);
    expect(countTags(html, 'button')).toBe(3);
    expect(html.match(/data-auth-mode="register"/g)).toHaveLength(3);
  });
});

describe('landing locale rendering', () => {
  it('renders the hero in English', () => {
    expect(renderToStaticMarkup(<Hero locale="en" />)).toContain('<h1');
  });
});
