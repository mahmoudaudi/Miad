// Browser-only fixtures. Every mutation is intercepted; never used by the application.
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const { mock, counts, failures } = require('./responsive.cjs');
const fs = require('fs');
fs.mkdirSync('/tmp/miad-qa', { recursive: true });
const base = process.env.MIAD_QA_URL || 'http://127.0.0.1:3100';
const assert = (ok, message) => {
  if (!ok) throw Error(message);
};
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.MIAD_QA_CHROME || '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  await mock(ctx);
  await ctx.addCookies([
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
  const page = await ctx.newPage();
  const checked = [];
  await page.goto(base + '/dashboard');
  await page.getByRole('heading', { name: 'Maya, what are we working on today?' }).waitFor();
  const menu = page.getByRole('button', { name: 'Open menu', exact: true });
  await menu.click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press('Tab');
    assert(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
      'Drawer focus escaped'
    );
  }
  await page.keyboard.press('Escape');
  assert(await menu.evaluate((el) => document.activeElement === el), 'Drawer focus not restored');
  checked.push('mobile drawer: focus containment, Escape, restore');
  await menu.click();
  await page.locator('aside').getByRole('button', { name: 'Account: Maya Haddad' }).click();
  await page.getByRole('region', { name: 'Account: Maya Haddad' }).waitFor();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  assert(await page.getByRole('dialog').isVisible(), 'Account Escape closed drawer');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('aside').getByRole('button', { name: 'Account: Maya Haddad' }).click();
  await page.getByRole('heading', { name: 'What will you create, Maya?' }).click();
  assert(
    (await page.getByRole('region', { name: 'Account: Maya Haddad' }).count()) === 0,
    'Outside account click failed'
  );
  checked.push('account: arrow navigation, Escape, outside click');
  await page.goto(base + '/dashboard/invitations/qa-invitation');
  await page.getByRole('button', { name: 'Publish', exact: true }).waitFor();
  failures['/invitations/qa-invitation/publication'] = true;
  await page.getByRole('button', { name: 'Publish', exact: true }).dblclick();
  await page.getByRole('button', { name: 'Retry publish' }).waitFor();
  assert(counts['PATCH /invitations/qa-invitation/publication'] === 1, 'Duplicate publish');
  delete failures['/invitations/qa-invitation/publication'];
  await page.getByRole('button', { name: 'Retry publish' }).click();
  await page.getByRole('button', { name: 'Published', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Unpublish', exact: true }).waitFor();
  checked.push('publish: rapid click, failure, retry, rolling success, unpublish available');
  await page.getByRole('button', { name: 'Share invitation' }).click();
  const shareDialog = page.getByRole('dialog', { name: 'Share invitation' });
  await shareDialog.waitFor();
  for (const [name, expected] of [
    ['WhatsApp', 'https://wa.me/'],
    ['Facebook', 'facebook.com/sharer/sharer.php'],
    ['X / Twitter', 'twitter.com/intent/tweet'],
    ['Telegram', 't.me/share/url'],
    ['Email', 'mailto:'],
  ]) {
    const href = await shareDialog.getByRole('link', { name: new RegExp(name) }).getAttribute('href');
    assert(href.startsWith(expected), `${name} share fallback missing`);
  }
  await shareDialog.getByRole('button', { name: /Instagram/ }).click();
  await shareDialog.getByRole('link', { name: 'Open Instagram' }).waitFor();
  assert(
    (await page.evaluate(() => navigator.clipboard.readText())).includes('/invite/garden-evening'),
    'Instagram did not copy the invitation URL'
  );
  checked.push('share: WhatsApp, Facebook, X, Telegram, Email URLs and Instagram copy/open fallback');
  await shareDialog.getByRole('button', { name: /Copy link/ }).click();
  await shareDialog.getByRole('status').getByText('Invitation link copied to your clipboard.').waitFor();
  assert(
    (await page.evaluate(() => navigator.clipboard.readText())).includes('/invite/garden-evening'),
    'Clipboard wrong URL'
  );
  await page.keyboard.press('Escape');
  await shareDialog.waitFor({ state: 'detached' });
  assert(
    await page
      .getByRole('button', { name: 'Share invitation' })
      .evaluate((el) => document.activeElement === el),
    'Share focus restore'
  );
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) },
    })
  );
  await page.getByRole('button', { name: 'Share invitation' }).click();
  const failedShareDialog = page.getByRole('dialog', { name: 'Share invitation' });
  await failedShareDialog.getByRole('button', { name: /Copy link/ }).click();
  await failedShareDialog.getByRole('status').getByText('Copy failed.', { exact: false }).waitFor();
  await page.keyboard.press('Escape');
  checked.push('share: clipboard success and denial, Escape, restoration');
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  assert(
    await page
      .getByRole('button', { name: 'Cancel', exact: true })
      .evaluate((el) => el === document.activeElement),
    'Delete default focus unsafe'
  );
  failures['/invitations/qa-invitation'] = true;
  const deleteDialog = page.getByRole('dialog');
  await deleteDialog.getByRole('button', { name: /Delete/ }).dblclick();
  await page.getByRole('alert').waitFor();
  assert(counts['DELETE /invitations/qa-invitation'] === 1, 'Duplicate deletion');
  delete failures['/invitations/qa-invitation'];
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Delete/ })
    .click();
  await page.waitForURL('**/dashboard/invitations');
  checked.push('delete: confirmation, rapid click guard, async failure, cancellation, success');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + '/dashboard/invitations/qa-invitation/editor');
  await page.waitForURL('**/dashboard/invitations/new?invitationId=qa-invitation');
  await page.getByRole('heading', { name: 'AI studio', exact: true }).waitFor();
  checked.push('legacy editor route opens the saved invitation in AI Studio');
  await page.goto(base + '/dashboard/invitations/new');
  const prompt = page.getByLabel('Describe your event', { exact: true });
  await prompt.fill('A garden dinner for Maya and friends');
  await page.getByRole('button', { name: 'Generate', exact: true }).dblclick();
  await page.getByRole('button', { name: 'Retry AI generation' }).waitFor();
  assert(
    (await prompt.inputValue()) === 'A garden dinner for Maya and friends',
    'AI failure lost prompt'
  );
  assert(counts['POST /ai-studio/generate'] === 1, 'Duplicate AI create');
  await page.getByRole('button', { name: 'Retry AI generation' }).click();
  await page.getByRole('link', { name: 'Continue in AI Studio', exact: true }).waitFor();
  assert(counts['POST /ai-studio/generate'] === 1, 'AI retry created duplicate invitation');
  checked.push('AI: rapid click, preserved prompt, existing invitation retry and success');
  await page.goto(base + '/dashboard/events/qa-event/guests/new');
  await page.locator('button[type=submit]').click();
  assert(
    (await page.locator('#name').getAttribute('aria-invalid')) === 'true',
    'Guest validation missing'
  );
  await page.locator('#name').fill('Nadia');
  await page.locator('#email').fill('nadia@example.test');
  await page.locator('button[type=submit]').click();
  await page.waitForURL('**/guests/qa-guest');
  checked.push('guest form: validation, accessible error association, submit success');
  await page.goto(base + '/dashboard/notifications');
  await page.getByRole('button', { name: 'Mark all as read', exact: true }).click();
  await page.getByText('You’re all caught up', { exact: true }).waitFor();
  checked.push('notifications: mark all read and live unread state');
  const violations = [];
  for (const route of [
    '/dashboard',
    '/dashboard/invitations/new',
    '/dashboard/invitations/qa-invitation',
    '/dashboard/invitations/qa-invitation/editor',
    '/dashboard/events/qa-event/guests',
    '/dashboard/events/qa-event/guests/new',
    '/dashboard/notifications',
  ]) {
    await page.goto(base + route);
    await page.locator('main h1').first().waitFor();
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    violations.push(
      ...result.violations.map((v) => ({
        route,
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      }))
    );
  }
  const anon = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  await mock(anon, false);
  const auth = await anon.newPage();
  await auth.goto(base + '/');
  await auth.getByRole('button', { name: 'Open menu', exact: true }).tap();
  await auth.getByRole('button', { name: 'Log in', exact: true }).tap();
  await auth.getByRole('dialog').waitFor();
  for (let i = 0; i < 15; i++) {
    await auth.keyboard.press('Tab');
    assert(
      await auth.getByRole('dialog').evaluate((el) => el.contains(document.activeElement)),
      'Auth focus escaped'
    );
  }
  await auth.keyboard.press('Escape');
  await auth.goto(base + '/login');
  await auth.getByLabel('Password', { exact: true }).fill('test-password');
  assert(
    (await auth.locator('.miad-characters').getAttribute('data-away')) === 'true',
    'Look away failed'
  );
  await auth.getByLabel('Email', { exact: true }).fill('maya@example.test');
  await auth.getByRole('button', { name: 'Log in', exact: true }).click();
  await auth.getByRole('alert').waitFor();
  assert(
    (await auth.getByLabel('Password', { exact: true }).inputValue()) === 'test-password',
    'Failed login lost password'
  );
  checked.push('auth: touch menu, modal focus containment, Escape, look-away, error preservation');
  for (const route of ['/', '/login', '/register']) {
    await auth.goto(base + route);
    await delay(600);
    const result = await new AxeBuilder({ page: auth })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    violations.push(
      ...result.violations.map((v) => ({
        route,
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
      }))
    );
  }
  await auth.emulateMedia({ reducedMotion: 'reduce' });
  assert(
    (await auth
      .locator('.miad-character')
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration)) === '0s',
    'Reduced motion'
  );
  checked.push('reduced motion: disabled CSS animation/transition');
  fs.writeFileSync(
    '/tmp/miad-qa/interaction-results.json',
    JSON.stringify({ checked, violations }, null, 2)
  );
  console.log(JSON.stringify({ checked, violations }, null, 2));
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
