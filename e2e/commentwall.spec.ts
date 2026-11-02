import { test, expect } from './fixtures';

test('Check site title', async ({ page }) => {
  // Expect exact title to be 'Comment Wall'.
  await page.goto('/');
  await expect(page).toHaveTitle('Comment Wall');
});

test('Check placeholder text in comment input', async ({ wall }) => {
  // The input is labelled and shows the expected placeholder
  await expect(wall.commentInput).toBeVisible();
  await expect(wall.commentInput).toHaveAttribute('placeholder', 'Leave a comment...');
  await expect(wall.commentInput).toHaveAttribute('maxlength', '500');
});

test('Character counter follows the input', async ({ wall }) => {
  await expect(wall.charCount).toHaveText('0 / 500');
  await wall.commentInput.fill('hello');
  await expect(wall.charCount).toHaveText('5 / 500');
});

test('UI shows the same comments as the first API page', async ({ wall, request }) => {
  // 1. Get the newest page of comments from the API (the page shows 50 at first)
  const response = await request.get('/comments?limit=50');
  await expect(response).toBeOK();
  const comments = await response.json();

  // 2. Compare with what the page shows
  await expect(wall.page.locator('.comment-text')).toHaveCount(comments.length);
});

test('A posted comment shows up right away', async ({ wall, page }) => {
  // Writes to the database, so it only runs against the local test server
  test.skip(!!process.env.BASE_URL, 'does not post to a deployed site');

  await page.setExtraHTTPHeaders({ 'X-Forwarded-For': '203.0.113.10' });
  const text = `e2e comment ${Date.now()}`;
  await wall.submitComment(text);

  // Polling runs every 5 s; the page must not wait for it
  await expect(page.locator('.comment-text', { hasText: text })).toBeVisible({ timeout: 3000 });
  await expect(wall.commentInput).toHaveValue('');
});
