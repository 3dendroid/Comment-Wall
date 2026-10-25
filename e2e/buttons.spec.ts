import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('Check "Submit" button', async ({ page }) => {
  await page.goto('/');

  // Expect the button to be visible, have the correct text, and have the correct type attribute.
  const submitButton = page.getByRole('button', { name: 'Submit' });
  await expect(submitButton).toBeVisible();
  await expect(submitButton).toHaveText('Submit');
  await expect(submitButton).toHaveAttribute('type', 'submit');
});

test('Check "Theme change" button', async ({ page }) => {
  await page.goto('/');

  // Expect the button to be visible, have the correct text, and have the correct type attribute.
  const switchThemeButton_light = page.getByRole('button', { name: '☀️ Switch Theme' });
  const switchThemeButton_dark = page.getByRole('button', { name: '🌙 Switch Theme' });

  await expect(switchThemeButton_dark).toBeVisible();
  await expect(switchThemeButton_dark).toHaveText('🌙 Switch Theme');
  await expect(switchThemeButton_dark).toHaveAttribute('id', 'themeToggle');

  await switchThemeButton_dark.click();

  await expect(switchThemeButton_light).toBeVisible();
  await expect(switchThemeButton_light).toHaveText('☀️ Switch Theme');
  await expect(switchThemeButton_light).toHaveAttribute('id', 'themeToggle');
});

test('Check "Admin" button', async ({ page }) => {
  await page.goto('/');

  // Expect the button to be visible, have the correct text, and have the correct type attribute.
  const adminButton = page.getByRole('button', { name: '🔐 Admin Mode' });
  await expect(adminButton).toBeVisible();
  await expect(adminButton).toHaveText('🔐 Admin Mode');
  await expect(adminButton).toHaveAttribute('onclick', 'enableAdmin()');
});
