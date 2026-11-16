import type { ClaimView } from '../shared/contracts.ts';
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) => route.abort());
});

test('queue, live processing, documents, policy, history and read-only instructions', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Claims queue' }),
  ).toBeVisible();
  await expect(
    page.getByText('Synthetic claim for automated tests.'),
  ).toBeVisible();
  await page.locator('summary').filter({ hasText: 'Test receipt' }).click();
  await expect(page.getByText('Synthetic test document.')).toBeVisible();
  await page
    .getByRole('button', { name: 'Agent instructions', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText(
    'Section 3 covers documented test flight delays.',
  );
  await page.getByRole('button', { name: 'Close instructions' }).click();
  await page.getByRole('button', { name: 'Run agent', exact: true }).click();
  await expect(page.getByText('Payment simulated: $420.00')).toBeVisible();
  await page.getByRole('button', { name: /Activity/ }).click();
  await expect(
    page.getByText('Processing completed', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Tool requested', { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Policy & history' }).click();
  await expect(
    page.getByText('Customer policy', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('TEST-002', { exact: true }).last(),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText('Payment simulated: $420.00')).toBeVisible();
});

test('backend blocks large payments until a handler signs off', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /TEST-002/ }).click();
  await page.getByRole('button', { name: 'Run agent', exact: true }).click();
  await expect(
    page.getByText('Payment is blocked until a handler signs off.'),
  ).toBeVisible();
  const view = (await (
    await request.get('/api/claims/TEST-002')
  ).json()) as ClaimView;
  const denied = await request.post('/api/claims/TEST-002/pay', {
    data: {
      thread_id: view.run?.thread_id,
      revision: view.revision,
      amount: 1500,
    },
  });
  expect(denied.status()).toBe(409);
  await expect(
    page.getByRole('button', { name: 'Simulate payment', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('Handler name').fill('Pilot reviewer');
  await page.getByRole('button', { name: 'Sign off decision' }).click();
  await expect(page.getByText('Signed off by Pilot reviewer')).toBeVisible();
  await page
    .getByRole('button', { name: 'Simulate payment', exact: true })
    .click();
  await expect(page.getByText('Payment simulated: $1,500.00')).toBeVisible();
});

test('declines and referrals never become payments', async ({ page }) => {
  for (const [id, decision] of [
    ['TEST-003', 'Decline'],
    ['TEST-004', 'Refer'],
  ]) {
    await page.goto('/');
    await page.getByRole('button', { name: new RegExp(id) }).click();
    await page.getByRole('button', { name: 'Run agent', exact: true }).click();
    await expect(page.getByTestId('decision')).toContainText(
      decision.toLowerCase(),
    );
    await expect(page.getByTestId('decision')).toContainText('$0.00');
    await expect(
      page.getByRole('button', { name: 'Simulate payment', exact: true }),
    ).toHaveCount(0);
  }
});

test('a model failure is visible and releases the claim for retry', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /TEST-005/ }).click();
  await page.getByRole('button', { name: 'Run agent', exact: true }).click();
  await expect(
    page.getByText('Stub model failed. Retry the claim.'),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Retry claim', exact: true }),
  ).toBeEnabled();
});

test('mobile layout stays within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Claims queue' }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
