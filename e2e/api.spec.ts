import { test, expect } from '@playwright/test';

// POST is limited to 1 per 5 seconds per client IP. The app trusts one
// X-Forwarded-For hop, so each test posts as its own "client".
const asClient = (ip: string) => ({ 'X-Forwarded-For': ip });

test('DELETE without token returns 401', async ({ request }) => {
  // Send a DELETE request without the Authorization header
  const response = await request.delete('/comments/55');

  // The server must refuse with 401 Unauthorized
  expect(response.status()).toBe(401);
  expect(await response.json()).toEqual({ error: 'Unauthorized' });
});

test('POST with empty comment returns 400', async ({ request }) => {
  // Send a POST request with an empty comment
  const response = await request.post('/comments', {
    data: { text: '' },
    headers: asClient('203.0.113.1'),
  });

  // The server must refuse with 400 Bad Request
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: 'Comment text is required' });
});

test('POST with non-string text returns 400', async ({ request }) => {
  // A number instead of a string used to crash the server with 500
  const response = await request.post('/comments', {
    data: { text: 123 },
    headers: asClient('203.0.113.2'),
  });

  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: 'Comment text must be a string' });
});

test('POST longer than 500 characters returns 400', async ({ request }) => {
  const response = await request.post('/comments', {
    data: { text: 'a'.repeat(501) },
    headers: asClient('203.0.113.3'),
  });

  expect(response.status()).toBe(400);
});
