import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('Check site title', async ({ page }) => {
  // Expect exact title to be 'Comment Wall'.
  await expect(page).toHaveTitle('Comment Wall');
});

test('Check placeholder text in comment input', async ({ page }) => {
  // Expect the placeholder text to be 'Write your comment here...'.
  const commentInput = page.getByRole('textbox');
  await expect(commentInput).toBeVisible();
  await expect(commentInput).toHaveAttribute('id', 'comment-input');
});

test('UI shows the same number of comments as the API', async ({ page, request }) => {
  // 1. Get comments from the API
  const response = await request.get('/comments');
  await expect(response).toBeOK();
  const comments = await response.json();

  // 2. Open the page and compare
  await page.goto('/');
  await expect(page.locator('.comment-text')).toHaveCount(comments.length);
});
