import { test, expect } from '@playwright/test';
import { Client } from 'pg';

// The database behind the site under test: production when BASE_URL is set,
// otherwise the local test server's database.
const connectionString = process.env.BASE_URL
  ? process.env.DATABASE_URL
  : process.env.E2E_DATABASE_URL;

test('API returns the same number of comments as the database', async ({ request }) => {
  test.skip(!connectionString?.startsWith('postgres'), 'needs a PostgreSQL database URL');

  // 1. connect to the database
  const db = new Client({ connectionString });

  await db.connect();
  let dbCommentCount;
  try {
    dbCommentCount = await db.query('SELECT COUNT(*) FROM comment');
  } finally {
    await db.end();
  }

  // 2. get comments from the API and check the response is OK
  const response = await request.get('/comments');
  await expect(response).toBeOK();
  const apiComments = await response.json();

  // 3. compare the two numbers
  expect(apiComments.length).toBe(Number(dbCommentCount.rows[0].count));
});
