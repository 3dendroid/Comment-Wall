import { test, expect } from './fixtures';
import { E2E_ADMIN_TOKEN } from '../playwright.config';

test('the page is served with a strict Content-Security-Policy', async ({ request }) => {
  const response = await request.get('/');
  const csp = response.headers()['content-security-policy'];
  expect(csp).toContain("default-src 'self'");
  expect(csp).not.toContain('unsafe-inline');
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
});

test('using the page triggers no CSP violations', async ({ page }) => {
  // Anything the policy blocks (inline script, style, handler) is reported here
  await page.addInitScript(() => {
    (window as any).cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) =>
      (window as any).cspViolations.push(`${e.violatedDirective}: ${e.blockedURI || 'inline'}`),
    );
  });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  await page.locator('#themeToggle').click();
  await page.getByRole('button', { name: 'Admin sign in' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'Make fun' }).click();
  await expect(page.locator('.cat-gif').first()).toBeAttached();
  // the cats still spin: their keyframes now come from style.css
  expect(await page.locator('.cat-gif').first().evaluate((el) => getComputedStyle(el).animationName)).toBe('spin');
  await page.getByRole('button', { name: 'Make fun' }).click();

  expect(await page.evaluate(() => (window as any).cspViolations)).toEqual([]);
});

test('an admin can delete a comment', async ({ page, request }) => {
  // Needs the local server's throwaway admin token and writes to the database
  test.skip(!!process.env.BASE_URL, 'does not change a deployed site');

  const text = `to be deleted ${Date.now()}`;
  const created = await request.post('/comments', {
    data: { text },
    headers: { 'X-Forwarded-For': '203.0.113.30' },
  });
  expect(created.status()).toBe(201);

  // reload so the comment is server-rendered, the path that used an inline onclick
  await page.goto('/');
  await page.getByRole('button', { name: 'Admin sign in' }).click();
  await page.getByLabel('Admin token').fill(E2E_ADMIN_TOKEN);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.locator('#admin-status')).toHaveText('Admin mode on');

  const comment = page.locator('.comment', { hasText: text });
  await comment.getByRole('button', { name: 'Delete' }).click();
  await expect(comment).toHaveCount(0);
});
