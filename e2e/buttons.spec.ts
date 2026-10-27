import { test, expect } from './fixtures';
import { CommentWallPage } from './pages/CommentWallPage';

test('Check "Submit" button', async ({ wall }) => {
  // Expect the button to be visible, have the correct text, and have the correct type attribute.
  await expect(wall.submitButton).toBeVisible();
  await expect(wall.submitButton).toHaveText('Submit');
  await expect(wall.submitButton).toHaveAttribute('type', 'submit');
});

test('Check "Theme change" button', async ({ wall }) => {
  // Check visibility, text and id

  await expect(wall.switchThemeButton_dark).toBeVisible();
  await expect(wall.switchThemeButton_dark).toHaveText('🌙 Switch Theme');
  await expect(wall.switchThemeButton_dark).toHaveAttribute('id', 'themeToggle');

  await wall.changeToLightTheme();

  await expect(wall.switchThemeButton_light).toBeVisible();
  await expect(wall.switchThemeButton_light).toHaveText('☀️ Switch Theme');
  await expect(wall.switchThemeButton_light).toHaveAttribute('id', 'themeToggle');
});

test('Check "Admin" button', async ({ wall }) => {
  // Check visibility, text and onclick
  await expect(wall.adminButton).toBeVisible();
  await expect(wall.adminButton).toHaveText('🔐 Admin Mode');
  await expect(wall.adminButton).toHaveAttribute('onclick', 'enableAdmin()');
});
