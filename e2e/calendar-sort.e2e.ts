/**
 * The sort bar, per `specs/04-04-calendar-sort.md` and the sort bar rules of
 * `specs/06-accessibility.md`: four buttons with Custom first, select-then-flip direction, the
 * orders each sort gives, persistence across reload without touching the stored order, and Move
 * up / Move down disabled while sorted.
 */
import { expect, test, type Page } from '@playwright/test';
import { open, readState, reopen, seedState } from './harness';

function dayKey(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const updatedAt = '2026-10-01T00:00:00.000Z';

/**
 * Custom order A, B, C, D. Visible activities 1, 5, 3, 0; scores 1, -5, 3, 0; latest counted days
 * yesterday, five days ago, today, never.
 */
function sortState(calendarSort?: { by: string; dir: string }) {
  return {
    version: 6,
    theme: 'light',
    ...(calendarSort ? { calendarSort } : {}),
    calendars: [
      { id: 'a', name: 'A', color: '#40c463', days: { [dayKey(-1)]: 1 }, activityValue: 1, updatedAt },
      { id: 'b', name: 'B', color: '#d73a49', days: { [dayKey(-5)]: 5 }, activityValue: -1, updatedAt },
      { id: 'c', name: 'C', color: '#0969da', days: { [dayKey(0)]: 3 }, activityValue: 1, updatedAt },
      { id: 'd', name: 'D', color: '#8250df', days: {}, activityValue: 1, updatedAt },
    ],
  };
}

const shown = (page: Page) => page.locator('.cal-card .cal-name-input').evaluateAll(els => els.map(el => (el as HTMLInputElement).value));
const bar = (page: Page) => page.getByRole('group', { name: 'Sort calendars' });
const sortButton = (page: Page, name: string) => bar(page).getByRole('button', { name: new RegExp(`^${name}`) });

test('the sort bar holds Custom, Activities, Score and Recent, with Custom selected on first run', async ({ page }) => {
  await seedState(page, sortState());
  await open(page);

  await expect(bar(page).getByRole('button')).toHaveText(['Custom', 'Activities', 'Score', 'Recent']);
  await expect(sortButton(page, 'Custom')).toHaveAttribute('aria-pressed', 'true');
  for (const name of ['Activities', 'Score', 'Recent']) {
    await expect(sortButton(page, name)).toHaveAttribute('aria-pressed', 'false');
  }
  expect(await shown(page)).toEqual(['A', 'B', 'C', 'D']);
});

test('a sort button selects high to low, flips on a second click, and Custom restores the order', async ({ page }) => {
  await seedState(page, sortState());
  await open(page);

  await sortButton(page, 'Activities').click();
  await expect(sortButton(page, 'Activities')).toHaveAttribute('aria-pressed', 'true');
  await expect(sortButton(page, 'Custom')).toHaveAttribute('aria-pressed', 'false');
  await expect(sortButton(page, 'Activities')).toHaveText('Activities ▼');
  await expect(sortButton(page, 'Activities')).toHaveAccessibleName('Activities, high to low');
  expect(await shown(page)).toEqual(['B', 'C', 'A', 'D']);

  await sortButton(page, 'Activities').click();
  await expect(sortButton(page, 'Activities')).toHaveText('Activities ▲');
  await expect(sortButton(page, 'Activities')).toHaveAccessibleName('Activities, low to high');
  expect(await shown(page)).toEqual(['D', 'A', 'C', 'B']);

  await sortButton(page, 'Score').click();
  await expect(sortButton(page, 'Activities')).toHaveText('Activities');
  expect(await shown(page)).toEqual(['C', 'A', 'D', 'B']);

  await sortButton(page, 'Recent').click();
  await expect(sortButton(page, 'Recent')).toHaveAccessibleName('Recent, most recent first');
  expect(await shown(page)).toEqual(['C', 'A', 'B', 'D']);
  await sortButton(page, 'Recent').click();
  await expect(sortButton(page, 'Recent')).toHaveAccessibleName('Recent, least recent first');
  expect(await shown(page)).toEqual(['D', 'B', 'A', 'C']);

  await sortButton(page, 'Custom').click();
  await expect(sortButton(page, 'Custom')).toHaveAttribute('aria-pressed', 'true');
  expect(await shown(page)).toEqual(['A', 'B', 'C', 'D']);
});

test('the selected sort persists across reload and never rewrites the stored order', async ({ page }) => {
  await seedState(page, sortState());
  await open(page);

  await sortButton(page, 'Recent').click();
  await sortButton(page, 'Recent').click();
  const stored = await readState(page);
  expect(stored.calendarSort).toEqual({ by: 'recent', dir: 'asc' });
  expect(stored.calendars.map((c: { id: string }) => c.id)).toEqual(['a', 'b', 'c', 'd']);

  await seedState(page, stored);
  await reopen(page);
  await expect(sortButton(page, 'Recent')).toHaveAttribute('aria-pressed', 'true');
  expect(await shown(page)).toEqual(['D', 'B', 'A', 'C']);
});

test('Move up and Move down are disabled while a sort other than Custom is selected', async ({ page }) => {
  await seedState(page, sortState({ by: 'score', dir: 'desc' }));
  await open(page);

  // A, the second card shown, could move both ways in custom order too.
  const card = page.locator('.cal-card').nth(1);
  await expect(card.locator('.cal-name-input')).toHaveValue('A');
  await card.getByRole('button', { name: 'Calendar actions' }).click();
  await expect(page.getByRole('menuitem', { name: 'Move up' })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'Move down' })).toBeDisabled();
  await page.keyboard.press('Escape');

  await sortButton(page, 'Custom').click();
  const second = page.locator('.cal-card').nth(1);
  await second.getByRole('button', { name: 'Calendar actions' }).click();
  await expect(page.getByRole('menuitem', { name: 'Move up' })).toBeEnabled();
  await expect(page.getByRole('menuitem', { name: 'Move down' })).toBeEnabled();
});
