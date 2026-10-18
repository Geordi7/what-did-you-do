import { test, expect } from '@playwright/test';
import { importFile, open, seedState } from './harness';

const calendar = { id: 'a', name: 'Walk', color: '#40c463', activityValue: 1, updatedAt: '2026-10-18T00:00:00.000Z', days: {} };

test('calendar menu provides named inputs, keyboard navigation and focus return', async ({ page }) => {
  await seedState(page, { version: 5, calendars: [calendar] });
  await open(page);
  await expect(page.getByLabel('Calendar name: Walk')).toBeVisible();
  const trigger = page.getByRole('button', { name: 'Calendar actions' });
  await trigger.click();
  await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  await expect(page.getByLabel('Color: Walk')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByLabel('Activity value: Walk')).toBeFocused();
  await page.keyboard.press('End');
  await expect(menu.getByRole('menuitem', { name: 'Delete', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByLabel('Color: Walk')).toBeFocused();
  await page.keyboard.press('Home');
  await expect(page.getByLabel('Color: Walk')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(menu.getByRole('menuitem', { name: 'Delete', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('day increments and resets announce the new count', async ({ page }) => {
  await seedState(page, { version: 5, calendars: [calendar] });
  await open(page);
  const cell = page.locator('.cell.today');
  await cell.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[aria-live="polite"]')).toContainText('1 activity');
  await page.keyboard.press('Delete');
  await expect(page.locator('[aria-live="polite"]')).toContainText('0 activities');
});

for (const version of [5, 999]) {
  test(`blocking dialog retains keyboard and programmatic focus (version ${version})`, async ({ page }) => {
    await seedState(page, { version, calendars: version === 5 ? [{ ...calendar, updatedAt: 'invalid' }] : [] });
    await open(page);
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    for (const key of ['Tab', 'Shift+Tab', 'Escape']) {
      await page.keyboard.press(key);
      expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    }
    await page.locator('.add-cal-btn').evaluate((el: HTMLButtonElement) => el.focus());
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  });
}

test('import dialog traps focus and returns it on cancel', async ({ page }) => {
  await seedState(page, { version: 5, calendars: [calendar] });
  await open(page);
  await importFile(page, 'calendar.json', JSON.stringify({ version: 5, calendars: [{ ...calendar, id: 'b' }] }));
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).focus();
  await page.keyboard.press('Tab');
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.locator('.add-cal-btn').evaluate((el: HTMLButtonElement) => el.focus());
  expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Import calendars' })).toBeFocused();
});
