import { test, expect } from '@playwright/test';
import { EXPORT_KEY, open, seed, STORAGE_KEY } from './harness';

test('backup reminder appears at exactly twenty-four hours', async ({ page }) => {
  const loaded = new Date('2026-10-18T12:00:00.000Z');
  await page.clock.setFixedTime(loaded);
  await seed(page, {
    [STORAGE_KEY]: JSON.stringify({ version: 5, calendars: [] }),
    [EXPORT_KEY]: String(loaded.getTime() - 24 * 60 * 60 * 1000),
  });
  await open(page);
  await expect(page.locator('.backup-banner')).toBeVisible();
});
