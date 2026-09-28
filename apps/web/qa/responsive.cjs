// Browser-only fixtures. Every mutation is intercepted; never used by the application.
const { chromium } = require('playwright');
const fs = require('fs');
fs.mkdirSync('/tmp/miad-qa', { recursive: true });
const base = process.env.MIAD_QA_URL || 'http://127.0.0.1:3100';
const stamp = '2026-09-25T08:00:00.000Z';
const user = {
  id: 'qa-user',
  firstName: 'Maya',
  lastName: 'Haddad',
  email: 'maya@example.test',
  role: 'user',
  isActive: true,
};
const event = {
  id: 'qa-event',
  invitationId: 'qa-invitation',
  title: 'An evening in the garden',
  eventType: 'Dinner',
  eventDate: '2026-10-12',
  startTime: '18:30',
  endTime: null,
  venueName: 'The Garden Room',
  venueAddress: 'Beirut',
  description: 'An evening together.',
  latitude: null,
  longitude: null,
  createdAt: stamp,
  updatedAt: stamp,
};
const invitation = {
  id: 'qa-invitation',
  eventId: event.id,
  slug: 'garden-evening',
  status: 'DRAFT',
  publishedAt: null,
  createdAt: stamp,
  updatedAt: stamp,
  event,
};
const spec = {
  schemaVersion: 1,
  theme: 'classic-ivory',
  content: {
    eyebrow: 'You are invited',
    title: 'An evening in the garden',
    dateLine: 'October 12 · Six in the evening',
    venueLine: 'The Garden Room',
  },
  colors: { background: '#FFFDF8', surface: '#FFFFFF', text: '#241C18', accent: '#8B7355' },
  typography: { headingFamily: 'Playfair Display', bodyFamily: 'Inter' },
  layout: { alignment: 'center', density: 'airy' },
};
const design = {
  id: 'qa-design',
  invitationId: invitation.id,
  version: 1,
  designSpecification: spec,
  sourceType: 'AI',
  isActive: true,
  createdAt: stamp,
};
const guest = {
  id: 'qa-guest',
  name: 'Nadia Salameh',
  email: 'nadia@example.test',
  phone: null,
  createdAt: stamp,
  updatedAt: stamp,
  rsvp: {
    status: 'ATTENDING',
    attendeesCount: 2,
    message: 'Looking forward to it!',
    respondedAt: stamp,
  },
};
const notification = {
  id: 'qa-notification',
  type: 'RSVP',
  title: 'Nadia confirmed attendance',
  message: 'Two guests will join your occasion.',
  isRead: false,
  createdAt: stamp,
};
const counts = {};
const failures = {};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function mock(context, authenticated = true) {
  await context.route('**/api/v1/**', async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.replace('/api/v1', '');
    counts[req.method() + ' ' + path] = (counts[req.method() + ' ' + path] || 0) + 1;
    if (req.method() === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': base,
          'access-control-allow-credentials': 'true',
          'access-control-allow-headers': 'content-type',
          'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
        },
      });
    const fulfill = (data, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: {
          'access-control-allow-origin': base,
          'access-control-allow-credentials': 'true',
        },
        body: JSON.stringify(data),
      });
    if (failures[path]) {
      await delay(300);
      return fulfill({ message: 'Temporary problem. Please try again.' }, 503);
    }
    if (path === '/auth/me' || path === '/auth/refresh')
      return fulfill(authenticated ? user : { message: 'Unauthorized' }, authenticated ? 200 : 401);
    if (path === '/auth/login' || path === '/auth/register')
      return fulfill({ message: 'Please check your details.' }, 400);
    if (path === '/auth/logout') return fulfill({ status: 'ok' });
    if (path === '/templates') return fulfill([]);
    if (req.method() === 'DELETE') {
      await delay(350);
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': base,
          'access-control-allow-credentials': 'true',
        },
      });
    }
    if (path.endsWith('/publication')) {
      await delay(400);
      const { published } = req.postDataJSON();
      invitation.status = published ? 'PUBLISHED' : 'DRAFT';
      invitation.publishedAt = published ? stamp : null;
      return fulfill(invitation);
    }
    if (path === '/events') return fulfill(req.method() === 'POST' ? event : [event]);
    if (path === '/invitations')
      return fulfill(req.method() === 'POST' ? invitation : [invitation]);
    if (path.endsWith('/design/ai/generate') || path.endsWith('/design/ai/refine')) {
      await delay(350);
      return fulfill(design);
    }
    if (path.endsWith('/design/editor')) {
      await delay(300);
      design.designSpecification = req.postDataJSON().designSpecification;
      return fulfill(design);
    }
    if (path.endsWith('/design')) {
      if (req.method() === 'PATCH') {
        await delay(300);
        design.designSpecification = { ...design.designSpecification, ...req.postDataJSON() };
        return fulfill(design);
      }
      return fulfill({ design });
    }
    if (path === '/notifications/read-all') return fulfill({ updated: 1 });
    if (path === '/notifications') return fulfill({ items: [notification], nextCursor: null });
    if (path.includes('/notifications/') && path.endsWith('/read'))
      return fulfill({ ...notification, isRead: true });
    if (path.endsWith('/guests')) return fulfill(req.method() === 'POST' ? guest : [guest]);
    if (path.includes('/guests/')) return fulfill(guest);
    if (path === '/events/qa-event') return fulfill(event);
    if (path === '/invitations/qa-invitation') return fulfill(invitation);
    if (path === '/ai-studio/generate') {
      await delay(500);
      return fulfill(
        { event, invitation, design: null, aiError: 'Generation temporarily unavailable.' },
        201
      );
    }
    return fulfill({ message: 'Unhandled QA endpoint ' + path }, 404);
  });
  await context.route('https://api.qrserver.com/**', (route) => route.abort());
}
async function run() {
  const browser = await chromium.launch({
    executablePath: process.env.MIAD_QA_CHROME || '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  await mock(context);
  await context.addCookies([
    {
      name: 'access_token',
      value:
        'qa.' +
        Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString(
          'base64url'
        ) +
        '.qa',
      url: base,
    },
  ]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const widths = [320, 375, 390, 414, 768, 1024, 1280, 1440, 1920];
  const routes = [
    '/dashboard',
    '/dashboard/invitations',
    '/dashboard/events',
    '/dashboard/events/new',
    '/dashboard/invitations/new',
    '/dashboard/invitations/qa-invitation',
    '/dashboard/invitations/qa-invitation/edit',
    '/dashboard/invitations/qa-invitation/design',
    '/dashboard/invitations/qa-invitation/editor',
    '/dashboard/events/qa-event/guests',
    '/dashboard/events/qa-event/guests/new',
    '/dashboard/events/qa-event/guests/qa-guest',
    '/dashboard/notifications',
  ];
  const overflows = [];
  for (const route of routes) {
    await page.goto(base + route);
    await page.locator('main h1').first().waitFor();
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      await delay(300);
      const bad = await page.evaluate(() =>
        [...document.querySelectorAll('main *,header *,aside *')]
          .filter((el) => {
            const r = el.getBoundingClientRect(),
              s = getComputedStyle(el);
            return (
              r.width > 0 &&
              s.visibility !== 'hidden' &&
              s.position !== 'absolute' &&
              r.right > innerWidth + 1 &&
              !el.closest('[aria-hidden="true"]') &&
              s.display !== 'none'
            );
          })
          .map((el) => ({
            tag: el.tagName,
            cls: el.className,
            right: Math.round(el.getBoundingClientRect().right),
          }))
          .slice(0, 6)
      );
      if (bad.length) overflows.push({ route, width, bad });
      if (
        [390, 1440].includes(width) &&
        [
          '/dashboard',
          '/dashboard/invitations/new',
          '/dashboard/invitations/qa-invitation/editor',
          '/dashboard/events/qa-event/guests',
          '/dashboard/invitations/qa-invitation',
        ].includes(route)
      )
        await page.screenshot({
          path: '/tmp/miad-qa/' + route.replaceAll('/', '_') + '-' + width + '.png',
          fullPage: true,
        });
    }
    process.stdout.write('Checked ' + route + '\n');
  }
  const anonymous = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mock(anonymous, false);
  const auth = await anonymous.newPage();
  for (const route of ['/', '/login', '/register']) {
    await auth.goto(base + route);
    await delay(800);
    for (const width of widths) {
      await auth.setViewportSize({ width, height: 900 });
      const x = await auth.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      if (x) overflows.push({ route, width });
    }
    await auth.setViewportSize({ width: 390, height: 844 });
    await auth.screenshot({
      path: '/tmp/miad-qa/' + (route === '/' ? 'landing' : route.slice(1)) + '-390.png',
      fullPage: true,
    });
  }
  await auth.goto(base + '/login');
  await auth.getByLabel('Password', { exact: true }).waitFor();
  await auth.getByLabel('Password', { exact: true }).focus();
  if ((await auth.locator('.miad-characters').getAttribute('data-away')) !== 'true')
    throw Error('Password look-away failed');
  await auth.emulateMedia({ reducedMotion: 'reduce' });
  const motion = await auth
    .locator('.miad-character')
    .first()
    .evaluate((el) => getComputedStyle(el).transitionDuration);
  if (motion !== '0s') throw Error('Reduced motion failed');
  fs.writeFileSync(
    '/tmp/miad-qa/responsive-results.json',
    JSON.stringify({ checks: (routes.length + 3) * widths.length, overflows, errors }, null, 2)
  );
  console.log(
    JSON.stringify({ checks: (routes.length + 3) * widths.length, overflows, errors }, null, 2)
  );
  await browser.close();
}
if (require.main === module)
  run().catch((e) => {
    console.error(e);
    process.exit(1);
  });
module.exports = {
  mock,
  user,
  event,
  invitation,
  spec,
  design,
  guest,
  notification,
  counts,
  failures,
};
