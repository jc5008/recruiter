import { expect, test } from '@playwright/test';

test('anonymous users cannot access the Post-Interview QA page', async ({ page }) => {
  await page.goto('/admin/report-qa');
  await expect(page).toHaveURL(/\/admin\/login\?from=%2Fadmin%2Freport-qa|\/admin\/login\?from=\/admin\/report-qa/);
  await expect(page.getByRole('heading', { name: 'Admin sign in' })).toBeVisible();
});

test('anonymous users cannot call the Post-Interview QA API', async ({ request }) => {
  const listResponse = await request.get('/api/admin/report-qa/runs');
  expect(listResponse.status()).toBe(401);

  const createResponse = await request.post('/api/admin/report-qa/runs', { data: {} });
  expect(createResponse.status()).toBe(401);
});
