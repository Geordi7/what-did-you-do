import { test, expect } from '@playwright/test';
import { open, seedState } from './harness';

test('grid and chart advance together across midnight', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 9, 18, 23, 59, 59) });
  await seedState(page, { version: 5, calendars: [{ id: 'a', name: 'Clock', color: '#40c463', activityValue: 1, updatedAt: '2026-10-18T00:00:00.000Z', days: {} }] });
  await open(page);
  await expect(page.locator('.cell.today')).toHaveAttribute('data-key', '2026-10-18');
  await page.clock.runFor(2000);
  await expect(page.locator('.cell.today')).toHaveAttribute('data-key', '2026-10-19');
  await expect(page.locator('.score-bar-hit').last()).toHaveAttribute('aria-label', /Oct 19/);
});
