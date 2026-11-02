import { test, expect } from './fixtures';

test.describe('network errors', () => {
  test('a failed post shows a message and keeps the text', async ({ wall, page }) => {
    await page.route('**/comments', (route) =>
      route.request().method() === 'POST' ? route.abort() : route.continue(),
    );
    await wall.submitComment('offline comment');

    await expect(page.locator('#form-error')).toHaveText("No connection. Your comment wasn't sent. Try again.");
    await expect(wall.commentInput).toHaveValue('offline comment');
    await expect(wall.submitButton).toBeEnabled();
  });

  test('a failed poll shows the offline status', async ({ wall, page }) => {
    await page.route('**/comments?limit=*', (route) => route.abort());
    // the next poll runs within 5 s
    await expect(page.locator('#live-status')).toHaveText('Offline · retrying', { timeout: 7000 });
    await expect(page.locator('#live-dot')).toHaveClass(/paused/);
  });
});

test.describe('theme', () => {
  test('a saved dark theme is on before the page is drawn', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'dark');
      // record the theme at the moment <body> appears, before any body script runs
      new MutationObserver((_, observer) => {
        if (document.body) {
          (window as any).darkWhenBodyAppeared = document.documentElement.classList.contains('dark');
          observer.disconnect();
        }
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto('/');
    expect(await page.evaluate(() => (window as any).darkWhenBodyAppeared)).toBe(true);
  });

  test('follows the device setting when nothing is saved', async ({ browser }) => {
    for (const colorScheme of ['dark', 'light'] as const) {
      const context = await browser.newContext({ colorScheme });
      const page = await context.newPage();
      await page.goto('/');
      if (colorScheme === 'dark') {
        await expect(page.locator('html')).toHaveClass(/dark/);
      } else {
        await expect(page.locator('html')).not.toHaveClass(/dark/);
      }
      await context.close();
    }
  });

  test('a saved choice beats the device setting', async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    await context.addInitScript(() => localStorage.setItem('theme', 'light'));
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    await context.close();
  });
});

test('cats do not spin with "reduce motion"', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: 'Make fun' }).click();

  const cat = page.locator('.cat-gif').first();
  await expect(cat).toBeAttached();
  expect(await cat.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');

  await page.getByRole('button', { name: 'Make fun' }).click(); // stop the music
  await context.close();
});

test('the site icon loads', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="icon"]').getAttribute('href');
  const response = await request.get(href!);
  await expect(response).toBeOK();
  expect(response.headers()['content-type']).toContain('image/svg+xml');
});

test('fonts come from this site, not from Google', async ({ page, baseURL }) => {
  const fontHosts = new Set<string>();
  page.on('request', (req) => {
    if (['font', 'stylesheet'].includes(req.resourceType())) fontHosts.add(new URL(req.url()).host);
  });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);

  expect([...fontHosts]).toEqual([new URL(baseURL!).host]);
  expect(await page.evaluate(() => document.fonts.check('16px "IBM Plex Sans"'))).toBe(true);
});

test('a double click on Post sends one request', async ({ wall, page }) => {
  // Writes to the database, so it only runs against the local test server
  test.skip(!!process.env.BASE_URL, 'does not post to a deployed site');

  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': '203.0.113.20' });
  let posts = 0;
  await page.route('**/comments', async (route) => {
    if (route.request().method() === 'POST') {
      posts++;
      await new Promise((resolve) => setTimeout(resolve, 500)); // a slow network
    }
    await route.continue();
  });

  await wall.commentInput.fill(`double click ${Date.now()}`);
  await wall.submitButton.dblclick();
  await expect(wall.commentInput).toHaveValue('');
  expect(posts).toBe(1);
  await expect(page.locator('#form-error')).toBeEmpty();
});
