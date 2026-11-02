import { Page, Locator } from '@playwright/test';

export class CommentWallPage {
  readonly page: Page;
  readonly commentInput: Locator;
  readonly submitButton: Locator;
  readonly charCount: Locator;
  // Named by what a click does: the light theme's button switches to dark.
  readonly toDarkThemeButton: Locator;
  readonly toLightThemeButton: Locator;
  readonly adminButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.commentInput = page.getByLabel('Your comment');
    this.submitButton = page.getByRole('button', { name: 'Post' });
    this.charCount = page.locator('#char-count');
    this.toDarkThemeButton = page.getByRole('button', { name: 'Switch to dark theme' });
    this.toLightThemeButton = page.getByRole('button', { name: 'Switch to light theme' });
    this.adminButton = page.getByRole('button', { name: 'Admin sign in' });
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
