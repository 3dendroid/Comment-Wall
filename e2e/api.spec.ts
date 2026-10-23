import { test, expect } from '@playwright/test';
import { array } from 'node:stream/iter';

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
  });

  // The server must refuse with 400 Bad Request
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ error: 'Comment text is required' });
});
