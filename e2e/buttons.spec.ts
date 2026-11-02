import { test, expect } from './fixtures';

test('Check "Submit" button', async ({ wall }) => {
  // Expect the button to be visible, have the correct text, and have the correct type attribute.
  await expect(wall.submitButton).toBeVisible();
  await expect(wall.submitButton).toHaveText('Submit');
  await expect(wall.submitButton).toHaveAttribute('type', 'submit');
});

test('Check "Theme change" button', async ({ wall }) => {
  // The page starts in the light theme, so the button offers the dark one
  await expect(wall.toDarkThemeButton).toBeVisible();
  await expect(wall.toDarkThemeButton).toHaveText('🌙 Switch Theme');
  await expect(wall.toDarkThemeButton).toHaveAttribute('id', 'themeToggle');

  await wall.changeToDarkTheme();

  await expect(wall.toLightThemeButton).toBeVisible();
  await expect(wall.toLightThemeButton).toHaveText('☀️ Switch Theme');
  await expect(wall.toLightThemeButton).toHaveAttribute('id', 'themeToggle');
});

test('Check "Admin" button', async ({ wall }) => {
  // Check visibility, text and onclick
  await expect(wall.adminButton).toBeVisible();
  await expect(wall.adminButton).toHaveText('🔐 Admin Mode');
  await expect(wall.adminButton).toHaveAttribute('onclick', 'enableAdmin()');
});

test('Admin button opens the sign-in dialog', async ({ wall, page }) => {
  await wall.adminButton.click();
  await expect(page.getByLabel('Admin token')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByLabel('Admin token')).toBeHidden();
});
