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

const backgroundImage = (page: Page, key: string) => cell(page, key).evaluate(el => getComputedStyle(el).backgroundImage);

test('future days are hatched and darkened, marked upcoming, and never change', async ({ page }) => {
  await openAtNow(page);

  for (const key of ['2026-10-22', '2026-10-23', '2026-11-22']) {
    await expect(cell(page, key)).toHaveClass(/\bfuture\b/);
    await expect(cell(page, key)).toHaveAttribute('aria-disabled', 'true');
    await expect(cell(page, key)).toHaveAccessibleName(/upcoming/);
    // The hatch, then a darkening layer over the cell colour.
    expect(await backgroundImage(page, key)).toMatch(/^repeating-linear-gradient\(.*\), linear-gradient\(/);
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

test('a line separates the months, with no banding behind the cells', async ({ page }) => {
  await openAtNow(page);

  const background = (key: string) => cell(page, key).locator('xpath=..').evaluate(el => getComputedStyle(el).backgroundColor);
  // Which sides of a day's slot carry the line: each inset shadow is "<colour> x y 0px 0px inset".
  const edges = (key: string) => cell(page, key).locator('xpath=..').evaluate(el => {
    const sides = { left: false, top: false, right: false, bottom: false };
    for (const shadow of getComputedStyle(el).boxShadow.split(/,(?![^(]*\))/)) {
      const [x, y] = (shadow.match(/(-?[\d.]+)px (-?[\d.]+)px/) ?? []).slice(1).map(Number);
      if (x > 0) sides.left = true;
      if (x < 0) sides.right = true;
      if (y > 0) sides.top = true;
      if (y < 0) sides.bottom = true;
    }
    return sides;
  });
  const none = { left: false, top: false, right: false, bottom: false };
  // 2026-10-01 is a Thursday. October's first seven days border September on their left, and
  // the 1st borders it above; September's last seven border October on their right, and the
  // 30th borders it below.
  expect(await edges('2026-10-01')).toEqual({ ...none, left: true, top: true });
  expect(await edges('2026-10-04')).toEqual({ ...none, left: true });
  expect(await edges('2026-10-05')).toEqual({ ...none, left: true });
  expect(await edges('2026-10-07')).toEqual({ ...none, left: true });
  expect(await edges('2026-10-08')).toEqual(none);
  expect(await edges('2026-09-30')).toEqual({ ...none, right: true, bottom: true });
  expect(await edges('2026-09-24')).toEqual({ ...none, right: true });
  expect(await edges('2026-09-23')).toEqual(none);
  // 2026-06-01 is a Monday and 2026-05-31 a Sunday: a straight edge, nothing above or below.
  expect(await edges('2026-06-01')).toEqual({ ...none, left: true });
  expect(await edges('2026-05-31')).toEqual({ ...none, right: true });

  const backgrounds = await Promise.all(['2026-09-30', '2026-10-01', '2026-11-01'].map(background));
  expect(new Set(backgrounds)).toEqual(new Set(['rgba(0, 0, 0, 0)']));
});

test('Saturdays and Sundays are tinted lighter than weekdays, past and future', async ({ page }) => {
  await openAtNow(page);
  // 2026-10-17/18 are a past weekend; 2026-10-24/25 an upcoming one.
  for (const key of ['2026-10-17', '2026-10-18']) {
    await expect(cell(page, key)).toHaveClass(/\bweekend\b/);
    expect(await backgroundImage(page, key)).toMatch(/^linear-gradient\(/);
  }
  for (const key of ['2026-10-24', '2026-10-25']) {
    await expect(cell(page, key)).toHaveClass(/\bweekend\b/);
    expect(await backgroundImage(page, key)).toMatch(/^repeating-linear-gradient\(.*\), linear-gradient\(.*\), linear-gradient\(/);
  }
  for (const key of ['2026-10-16', '2026-10-19']) {
    await expect(cell(page, key)).not.toHaveClass(/\bweekend\b/);
    expect(await backgroundImage(page, key)).toBe('none');
  }
});
