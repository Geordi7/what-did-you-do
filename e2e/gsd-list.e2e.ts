/**
 * GSD calendars in the calendar list, per `specs/04-design.md` (section and controls),
 * `specs/04-05-calendar-grid.md` "Cells" and "Detail panel", `specs/04-04-calendar-sort.md`
 * "Filter", and `specs/06-accessibility.md` "GSD calendars in the list".
 */
import { expect, test, type Page } from '@playwright/test';
import { chooseFromMenu, open, readState, reopen, seedState } from './harness';

// 2026-10-21 is a Wednesday.
const NOW = new Date(2026, 9, 21, 12, 0, 0);

const runs = { kind: 'scoring', id: 'runs', name: 'Runs', color: '#216e39', activityValue: 1, updatedAt: '2026-10-01T00:00:00.000Z', days: { '2026-10-20': 2 } };

/**
 * 10-19: root `a` created (1) and Nudge `a1` created (0.5); `a1` is due and still open, so overdue.
 * 10-20: root `b` created (1) and done on time with bounty 2 (2); `a` is due and open, overdue.
 * 10-22: `c` was due, but it is done: no dot. 10-24: `d` is due and open, upcoming.
 */
const chores = {
  kind: 'gsd', id: 'chores', name: 'Chores', color: '#40c463', defaultBounty: 1, updatedAt: '2026-10-01T00:00:00.000Z',
  todos: [
    { id: 'a', title: 'Taxes', bounty: 3, due: '2026-10-20', created: '2026-10-19', children: [
      { id: 'a1', title: 'Find forms', bounty: 0.5, due: '2026-10-19', created: '2026-10-19', children: [] },
    ] },
    { id: 'b', title: 'Bins', bounty: 2, due: '2026-10-21', created: '2026-10-20', done: '2026-10-20', children: [] },
    { id: 'c', title: 'Call', bounty: 1, due: '2026-10-22', created: '2026-10-01', done: '2026-10-02', children: [] },
    { id: 'd', title: 'Dentist', bounty: 1, due: '2026-10-24', created: '2026-10-01', children: [] },
  ],
};

async function openSeeded(page: Page, extra: Record<string, unknown> = {}) {
  await page.clock.setFixedTime(NOW);
  await seedState(page, { version: 7, theme: 'light', calendars: [runs, chores], ...extra });
  await open(page);
}

const section = (page: Page, name: string) => page.locator('.cal-card').filter({ has: page.getByRole('textbox', { name: `Calendar name: ${name}`, exact: true }) });
const cell = (page: Page, key: string) => section(page, 'Chores').locator(`.cell[data-key="${key}"]`);

test('the create bar makes a GSD calendar when that kind is chosen', async ({ page }) => {
  await openSeeded(page);
  await chooseFromMenu(page, 'New calendar');
  const kinds = page.getByRole('radiogroup', { name: 'Calendar kind' });
  await expect(kinds.getByRole('radio', { name: 'Scoring' })).toBeChecked();
  await kinds.getByRole('radio', { name: 'Getting Stuff Done' }).check();
  await page.getByRole('textbox', { name: 'New calendar name' }).fill('Errands');
  await page.getByRole('button', { name: 'Create', exact: true }).click();

  const stored = await readState(page);
  expect(stored.calendars[2]).toMatchObject({ kind: 'gsd', name: 'Errands', defaultBounty: 1, todos: [] });
  await expect(section(page, 'Errands').locator('.cal-stat')).toHaveText('0 done');
});

test('a GSD section is set apart, with its total and an Open button', async ({ page }) => {
  await openSeeded(page);
  const gsd = section(page, 'Chores');
  await expect(gsd).toHaveClass(/\bcal-card-gsd\b/);
  await expect(gsd.locator('.gsd-icon')).toHaveText('☑');
  await expect(gsd.locator('.gsd-icon')).toHaveAttribute('aria-hidden', 'true');
  await expect(gsd.locator('.gsd-tag')).toHaveText('GSD');
  await expect(gsd.locator('.cal-stat')).toHaveText('2 done');
  await expect(gsd.getByRole('button', { name: 'Open Chores todos' })).toBeVisible();
  expect(await gsd.evaluate(el => getComputedStyle(el, '::before').width)).toBe('3px');
  // Set apart without shifting: its grid's columns line up with a scoring calendar's.
  const firstCell = async (name: string) => (await section(page, name).locator('.cell').first().boundingBox())!.x;
  expect(await firstCell('Chores')).toBe(await firstCell('Runs'));
  // The tag sits right after the name.
  const nameBox = (await gsd.getByRole('textbox', { name: 'Calendar name: Chores' }).boundingBox())!;
  const tagBox = (await gsd.locator('.gsd-tag').boundingBox())!;
  expect(tagBox.x - (nameBox.x + nameBox.width)).toBeLessThan(12);
  await expect(section(page, 'Runs')).not.toHaveClass(/\bcal-card-gsd\b/);
  await expect(section(page, 'Runs').locator('.gsd-tag')).toHaveCount(0);
});

test('a GSD day shows its figures on hover, colours by todos done at any depth, and names itself', async ({ page }) => {
  // 10-18: a Nudge of the open root `d` is done, so it colours like 10-20's one root done.
  const nudged = structuredClone(chores);
  nudged.todos[3].children.push({ id: 'd1', title: 'Book', bounty: 0.5, created: '2026-10-18', done: '2026-10-18', children: [] } as never);
  await openSeeded(page, { calendars: [runs, nudged] });
  await cell(page, '2026-10-20').hover();
  await expect(section(page, 'Chores').locator('.detail-number')).toHaveText('Created 1 · Finished 1 · Due 1 · +3.0 points');
  await cell(page, '2026-10-19').hover();
  await expect(section(page, 'Chores').locator('.detail-number')).toHaveText('Created 2 · Finished 0 · Due 1 · +1.5 points');

  const fill = (key: string) => cell(page, key).evaluate(el => getComputedStyle(el).backgroundColor);
  expect(await fill('2026-10-20')).not.toBe(await fill('2026-10-19'));
  expect(await fill('2026-10-02')).toBe(await fill('2026-10-20'));
  expect(await fill('2026-10-18')).toBe(await fill('2026-10-20'));
  await expect(cell(page, '2026-10-20')).toHaveAccessibleName('Tue, Oct 20, 2026: created 1, finished 1, due 1, +3.0 points. Open todos');
  await expect(cell(page, '2026-10-24')).not.toHaveAttribute('aria-disabled', 'true');
});

test('days with open todos due carry a dot, red once past', async ({ page }) => {
  await openSeeded(page);
  const dot = (key: string) => cell(page, key).locator('.due-dot');
  await expect(dot('2026-10-24')).toHaveCount(1);
  await expect(dot('2026-10-24')).not.toHaveClass(/\boverdue\b/);
  await expect(dot('2026-10-19')).toHaveClass(/\boverdue\b/);
  await expect(dot('2026-10-20')).toHaveClass(/\boverdue\b/);
  await expect(dot('2026-10-21')).toHaveCount(0);
  await expect(dot('2026-10-22')).toHaveCount(0);
  await expect(section(page, 'Runs').locator('.due-dot')).toHaveCount(0);
  const colour = (key: string) => dot(key).evaluate(el => getComputedStyle(el).backgroundColor);
  expect(await colour('2026-10-19')).not.toBe(await colour('2026-10-24'));
});

test('clicking a GSD section or day opens its todo page and changes nothing', async ({ page }) => {
  await openSeeded(page);
  const before = await readState(page);

  await cell(page, '2026-10-20').click();
  await expect(page).toHaveURL(/#\/gsd\/chores$/);
  await page.evaluate(() => { location.hash = ''; });
  await cell(page, '2026-10-24').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/gsd\/chores$/);
  await page.evaluate(() => { location.hash = ''; });
  await section(page, 'Chores').locator('.cal-card-header').click({ position: { x: 300, y: 5 } });
  await expect(page).toHaveURL(/#\/gsd\/chores$/);
  await page.evaluate(() => { location.hash = ''; });
  await section(page, 'Chores').getByRole('button', { name: 'Open Chores todos' }).click();
  await expect(page).toHaveURL(/#\/gsd\/chores$/);
  await page.evaluate(() => { location.hash = ''; });

  // The name and the menu are not ways in.
  await section(page, 'Chores').getByRole('button', { name: 'Calendar actions' }).click();
  await page.keyboard.press('Escape');
  await section(page, 'Chores').getByRole('textbox', { name: 'Calendar name: Chores' }).click();
  await page.keyboard.press('Escape');
  expect(new URL(page.url()).hash).toBe('');

  expect(await readState(page)).toEqual(before);
});

test('the filter shows one kind, persists, and disables reordering', async ({ page }) => {
  await openSeeded(page);
  const filter = page.getByRole('group', { name: 'Filter calendars' });
  const buttons = filter.getByRole('button');
  await expect(buttons).toHaveText(['All', 'Scoring', 'GSD']);
  await expect(filter.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.cal-card')).toHaveCount(2);

  await filter.getByRole('button', { name: 'GSD' }).click();
  await expect(filter.getByRole('button', { name: 'GSD' })).toHaveAttribute('aria-pressed', 'true');
  await expect(filter.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.cal-card')).toHaveCount(1);
  await expect(section(page, 'Runs')).toHaveCount(0);
  await section(page, 'Chores').getByRole('button', { name: 'Calendar actions' }).click();
  await expect(page.getByRole('menuitem', { name: 'Move up' })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'Move down' })).toBeDisabled();
  await page.keyboard.press('Escape');

  expect((await readState(page)).calendarFilter).toBe('gsd');
  await page.clock.setFixedTime(NOW);
  await seedState(page, await readState(page));
  await reopen(page);
  await expect(page.getByRole('group', { name: 'Filter calendars' }).getByRole('button', { name: 'GSD' })).toHaveAttribute('aria-pressed', 'true');
  await expect(section(page, 'Runs')).toHaveCount(0);

  await page.getByRole('group', { name: 'Filter calendars' }).getByRole('button', { name: 'Scoring' }).click();
  await expect(section(page, 'Chores')).toHaveCount(0);
  await expect(section(page, 'Runs')).toHaveCount(1);
});

test('a GSD menu sets the default bounty in place of an activity value', async ({ page }) => {
  await openSeeded(page);
  await section(page, 'Chores').getByRole('button', { name: 'Calendar actions' }).click();
  await expect(page.getByRole('menuitem', { name: 'Activity value: Chores' })).toHaveCount(0);
  const bounty = page.getByRole('menuitem', { name: 'Default bounty: Chores' });
  await expect(bounty).toHaveValue('1');
  await bounty.fill('2.5');
  await bounty.press('Enter');
  await expect.poll(async () => (await readState(page)).calendars[1].defaultBounty).toBe(2.5);
  await bounty.fill('-1');
  await bounty.press('Enter');
  await expect(bounty).toHaveValue('2.5');
  expect((await readState(page)).calendars[1].defaultBounty).toBe(2.5);
});
