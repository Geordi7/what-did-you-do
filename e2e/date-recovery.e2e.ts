import { test, expect } from '@playwright/test';
import { open, readKey, seed, STORAGE_KEY } from './harness';

test('an impossible date leaves original data available for repair', async ({ page }) => {
  const raw = JSON.stringify({ version: 5, calendars: [{ id: 'bad', name: 'Recovery', days: { '2026-02-30': 4 }, color: '#40c463', activityValue: -0.5, updatedAt: '2026-10-18T00:00:00.000Z' }] });
  await seed(page, { [STORAGE_KEY]: raw });
  await open(page);
  await expect(page.getByRole('alertdialog')).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download saved data', exact: true }).click();
  const download = await pending;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  expect(Buffer.concat(chunks).toString('utf8')).toBe(raw);
  expect(await readKey(page, STORAGE_KEY)).toBe(raw);
});
