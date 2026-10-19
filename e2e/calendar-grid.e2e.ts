/**
 * The calendar grid's window, month bands and future days, per `specs/04-05-calendar-grid.md`
 * "Window" and the future-day rule of `specs/06-accessibility.md` "Calendar cells".
 */
import { expect, test, type Page } from '@playwright/test';
import { open, readState, seedState } from './harness';

// 2026-10-21 is a Wednesday; its week opens on Monday 2026-10-19.
const NOW = new Date(2026, 9, 21, 12, 0, 0);

const calendar = { id: 'a', name: 'Walk', color: '#40c463', activityValue: 1, updatedAt: '2026-10-18T00:00:00.000Z', days: { '2026-10-23': 2 } };

async function openAtNow(page: Page) {
  await page.clock.setFixedTime(NOW);
  await seedState(page, { version: 6, theme: 'light', calendars: [calendar] });
  await open(page);
}

const cell = (page: Page, key: string) => page.locator(`.cell[data-key="${key}"]`);
const days = async (page: Page) => (await readState(page)).calendars[0].days;

test('the grid runs 22 weeks ending with the current week, then 4 weeks ahead', async ({ page }) => {
  await openAtNow(page);

  const columns = page.locator('.week-col');
  await expect(columns).toHaveCount(26);
  await expect(columns.nth(21).locator('.cell').first()).toHaveAttribute('data-key', '2026-10-19');
  await expect(page.locator('.cell').first()).toHaveAttribute('data-key', '2026-05-25');
  await expect(page.locator('.cell').last()).toHaveAttribute('data-key', '2026-11-22');
  await expect(page.locator('.cell.today')).toHaveAttribute('data-key', '2026-10-21');
  // The grid opens on 2026-05-25, so May's single column gives way to June's label.
  await expect(page.locator('.month-labels span')).toHaveText(['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']);
});

test('future days are hatched, marked upcoming, and never change', async ({ page }) => {
  await openAtNow(page);

  for (const key of ['2026-10-22', '2026-10-23', '2026-11-22']) {
    await expect(cell(page, key)).toHaveClass(/\bfuture\b/);
    await expect(cell(page, key)).toHaveAttribute('aria-disabled', 'true');
    await expect(cell(page, key)).toHaveAccessibleName(/upcoming/);
    expect(await cell(page, key).evaluate(el => getComputedStyle(el).backgroundImage)).toContain('repeating-linear-gradient');
  }
  for (const key of ['2026-10-20', '2026-10-21']) {
    await expect(cell(page, key)).not.toHaveClass(/\bfuture\b/);
    await expect(cell(page, key)).not.toHaveAttribute('aria-disabled', 'true');
    expect(await cell(page, key).evaluate(el => getComputedStyle(el).backgroundImage)).toBe('none');
  }

  // Imported counts on a future day still show, and the day still highlights.
  await cell(page, '2026-10-23').hover();
  await expect(page.locator('.detail-number')).toHaveText('2 × 1 = 2.0');

  // Playwright treats aria-disabled as not actionable; force the click a user can still make.
  await cell(page, '2026-10-22').click({ force: true });
  await cell(page, '2026-10-23').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Delete');
  await cell(page, '2026-10-23').dispatchEvent('pointerdown');
  await page.clock.runFor(700);
  await cell(page, '2026-10-23').dispatchEvent('pointerup');
  expect(await days(page)).toEqual({ '2026-10-23': 2 });

  // Today still takes a click.
  await cell(page, '2026-10-21').click();
  await expect.poll(() => days(page)).toEqual({ '2026-10-23': 2, '2026-10-21': 1 });
});

test('the background behind the cells alternates by calendar month', async ({ page }) => {
  await openAtNow(page);

  const band = (key: string) => cell(page, key).locator('xpath=..').evaluate(el => getComputedStyle(el).backgroundColor);
  const [sep30, oct1, oct31, nov1, sep1] = await Promise.all(['2026-09-30', '2026-10-01', '2026-10-31', '2026-11-01', '2026-09-01'].map(band));
  expect(oct1).toBe(oct31);
  expect(sep30).not.toBe(oct1);
  expect(nov1).not.toBe(oct1);
  expect(nov1).toBe(sep30);
  expect(sep1).toBe(sep30);
  // The cells themselves keep their own colour: two empty days in different months match.
  const fill = (key: string) => cell(page, key).evaluate(el => getComputedStyle(el).backgroundColor);
  expect(await fill('2026-09-30')).toBe(await fill('2026-10-01'));
});
