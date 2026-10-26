import { test, expect } from '@playwright/test';
import { Client } from 'pg';

test('API returns the same number of comments as the database', async ({ request }) => {
  // 1. connect to the database
  const db = new Client({ connectionString: process.env.DATABASE_URL });

  await db.connect();
  let dbCommentCount;
  try {
    dbCommentCount = await db.query('SELECT COUNT(*) FROM comment');
  } finally {
    await db.end();
  }

  // 4. get comments from the API and check the response is OK
  const response = await request.get('/comments');
  await expect(response).toBeOK();
  const apiComments = await response.json();

  // 5. compare the two numbers
  expect(apiComments.length).toBe(Number(dbCommentCount.rows[0].count));
});
