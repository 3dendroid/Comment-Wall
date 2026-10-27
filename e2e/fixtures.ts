import { test as base } from '@playwright/test';
import { CommentWallPage } from './pages/CommentWallPage';

type MyFixtures = {
  wall: CommentWallPage;
};

export const test = base.extend<MyFixtures>({
  wall: async ({ page }, use) => {
    const wall = new CommentWallPage(page);
    await wall.goto();
    await use(wall);
  },
});

export { expect } from '@playwright/test';
