import { test, expect, APIRequestContext } from '@playwright/test';

// POST is limited to 1 per 5 seconds per client IP. Locally each test posts as
// its own "client" via X-Forwarded-For. Behind Railway's proxy the real IP wins,
// so all tests share one limit there: on 429, wait it out and try again.
const asClient = (ip: string) => ({ 'X-Forwarded-For': ip });

async function postComment(request: APIRequestContext, data: unknown, ip: string) {
  for (let attempt = 1; ; attempt++) {
    const response = await request.post('/comments', { data, headers: asClient(ip) });
    if (response.status() !== 429 || attempt === 4) return response;
    await new Promise((resolve) => setTimeout(resolve, 5500));
  }
}

test('DELETE without token returns 401', async ({ request }) => {
  // Send a DELETE request without the Authorization header
  const response = await request.delete('/comments/55');

  // The server must refuse with 401 Unauthorized
  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ error: 'Unauthorized' });
});

test('POST with empty comment returns 400', async ({ request }) => {
  // Send a POST request with an empty comment
  const response = await postComment(request, { text: '' }, '203.0.113.1');

  // The server must refuse with 400 Bad Request
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: 'Comment text is required' });
});

test('POST with non-string text returns 400', async ({ request }) => {
  // A number instead of a string used to crash the server with 500
  const response = await postComment(request, { text: 123 }, '203.0.113.2');

  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: 'Comment text must be a string' });
});

test('POST longer than 500 characters returns 400', async ({ request }) => {
  const response = await postComment(request, { text: 'a'.repeat(501) }, '203.0.113.3');

  expect(response.status()).toBe(400);
});
