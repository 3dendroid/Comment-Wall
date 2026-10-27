import { Page, Locator } from '@playwright/test';

export class CommentWallPage {
  readonly page: Page;
  readonly commentInput: Locator;
  readonly submitButton: Locator;
  readonly switchThemeButton_light: Locator;
  readonly switchThemeButton_dark: Locator;
  readonly adminButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.commentInput = page.getByRole('textbox', { name: 'Comment' });
    this.submitButton = page.getByRole('button', { name: 'Submit' });
    this.switchThemeButton_light = page.getByRole('button', { name: '☀️ Switch Theme' });
    this.switchThemeButton_dark = page.getByRole('button', { name: '🌙 Switch Theme' });
    this.adminButton = page.getByRole('button', { name: '🔐 Admin Mode' });
  }

  async goto() {
    await this.page.goto('/');
  }

  async submitComment(comment: string) {
    await this.commentInput.fill(comment);
    await this.submitButton.click();
  }

  async changeToDarkTheme() {
    await this.switchThemeButton_light.click();
  }

  async changeToLightTheme() {
    await this.switchThemeButton_dark.click();
  }
}
