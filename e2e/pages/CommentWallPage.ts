import { Page, Locator } from '@playwright/test';

export class CommentWallPage {
  readonly page: Page;
  readonly commentInput: Locator;
  readonly submitButton: Locator;
  readonly charCount: Locator;
  // Named by what a click does: in the light theme the button shows 🌙 and switches to dark.
  readonly toDarkThemeButton: Locator;
  readonly toLightThemeButton: Locator;
  readonly adminButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.commentInput = page.getByLabel('Your comment');
    this.submitButton = page.getByRole('button', { name: 'Submit' });
    this.charCount = page.locator('#char-count');
    this.toDarkThemeButton = page.getByRole('button', { name: '🌙 Switch Theme' });
    this.toLightThemeButton = page.getByRole('button', { name: '☀️ Switch Theme' });
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
    await this.toDarkThemeButton.click();
  }

  async changeToLightTheme() {
    await this.toLightThemeButton.click();
  }
}
