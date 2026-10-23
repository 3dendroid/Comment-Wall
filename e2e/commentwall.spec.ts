import { test, expect } from '@playwright/test';

test('check title', async ({ page }) => {
  await page.goto('/');

  // Expect exact title to be 'Anonymous Comment Wall'.
  await expect(page).toHaveTitle('Anonymous Comment Wall');
});

test('check button', async ({ page }) => {
  await page.goto('/');

  // Expect the button to be visible, have the correct text, and have the correct type attribute.
  const submitButton = page.getByRole('button', { name: 'Submit' });
  await expect(submitButton).toBeVisible();
  await expect(submitButton).toHaveText('Submit');
  await expect(submitButton).toHaveAttribute('type', 'submit');
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
