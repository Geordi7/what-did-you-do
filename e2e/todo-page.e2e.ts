/**
 * A GSD calendar's todo page, per `specs/04-06-todo-page.md`, the todo rules of
 * `specs/03-04-gsd-points.md`, and `specs/06-accessibility.md` "Todo page".
 */
import { expect, test, type Page } from '@playwright/test';
import { open, readState, seedState } from './harness';

// 2026-10-21 is a Wednesday; a week later is 2026-10-28.
const NOW = new Date(2026, 9, 21, 12, 0, 0);

const runs = { kind: 'scoring', id: 'runs', name: 'Runs', color: '#216e39', activityValue: 1, updatedAt: '2026-10-01T00:00:00.000Z', days: {} };

/**
 * Roots by due date: `late` (10-15, open: overdue), `soon` (10-25), `undated`, then `finished`,
 * which is done and sinks. `soon` has a Nudge `step`, open, so `soon` cannot be ticked.
 */
function chores() {
  return {
    kind: 'gsd', id: 'chores', name: 'Chores', color: '#40c463', defaultBounty: 2, updatedAt: '2026-10-01T00:00:00.000Z',
    todos: [
      { id: 'undated', title: 'Someday', bounty: 1, created: '2026-10-02', children: [] },
      { id: 'finished', title: 'Bins', bounty: 1, due: '2026-10-10', created: '2026-10-01', done: '2026-10-09', children: [
        { id: 'fstep', title: 'Find bags', bounty: 0.5, created: '2026-10-01', done: '2026-10-08', children: [] },
      ] },
      { id: 'soon', title: 'Taxes', bounty: 3, due: '2026-10-25', created: '2026-10-03', children: [
        { id: 'step', title: 'Find forms', bounty: 0.5, due: '2026-10-25', created: '2026-10-19', children: [] },
      ] },
      { id: 'late', title: 'Dentist', bounty: 1, due: '2026-10-15', created: '2026-10-01', children: [] },
    ],
  };
}

async function openPage(page: Page, hash = '#/gsd/chores') {
  await page.clock.setFixedTime(NOW);
  await seedState(page, { version: 7, theme: 'light', calendars: [runs, chores()] });
  await open(page);
  await page.evaluate(h => { location.hash = h; }, hash);
}

const tree = (page: Page) => page.locator('.todo-tree');
const titles = (page: Page) => tree(page).locator('.todo-title');
/** The tree's titles in display order; titles are inputs, so their values, not their text. */
const titleValues = (page: Page) => titles(page).evaluateAll(els => els.map(el => (el as HTMLInputElement).value));

interface StoredTodo { id: string; title: string; bounty: number; due?: string; created: string; done?: string; cancelled?: string; children: StoredTodo[] }
const gsdTodos = async (page: Page): Promise<StoredTodo[]> => (await readState(page)).calendars[1].todos;
function findTodo(todos: StoredTodo[], id: string): StoredTodo | null {
  for (const t of todos) {
    if (t.id === id) return t;
    const inner = findTodo(t.children, id);
    if (inner) return inner;
  }
  return null;
}

test('opens from the list, hides the list, and returns by Back or the Calendars control', async ({ page }) => {
  await page.clock.setFixedTime(NOW);
  await seedState(page, { version: 7, theme: 'light', calendars: [runs, chores()] });
  await open(page);
  await page.getByRole('button', { name: 'Open Chores todos' }).click();
  await expect(page.getByRole('heading', { name: 'Chores', level: 2 })).toBeVisible();
  await expect(page.locator('.score-chart')).toHaveCount(0);
  await expect(page.locator('.sort-bar-row')).toHaveCount(0);
  await expect(page.locator('.cal-card')).toHaveCount(0);
  await expect(page.locator('.todo-page .cell')).toHaveCount(26 * 7);
  await expect(page.locator('header')).toBeVisible();

  await page.goBack();
  await expect(page.locator('.score-chart')).toHaveCount(1);
  await expect(page.locator('.todo-page')).toHaveCount(0);

  await page.getByRole('button', { name: 'Open Chores todos' }).click();
  await page.getByRole('link', { name: '← Calendars' }).click();
  await expect(page.locator('.cal-card')).toHaveCount(2);
  expect(new URL(page.url()).hash).toBe('');
});

test('a hash naming no active GSD calendar says so', async ({ page }) => {
  for (const hash of ['#/gsd/missing', '#/gsd/runs']) {
    await openPage(page, hash);
    await expect(page.getByText('That calendar could not be found.')).toBeVisible();
    await expect(page.getByRole('link', { name: '← Calendars' })).toBeVisible();
    await expect(page.locator('.todo-tree')).toHaveCount(0);
  }
});

test('the tree runs by due date, undated last, done todos sinking and struck through', async ({ page }) => {
  await openPage(page);
  await expect.poll(() => titleValues(page)).toEqual(['Dentist', 'Taxes', 'Find forms', 'Someday', 'Bins', 'Find bags']);
  const row = (id: string) => tree(page).locator(`li[data-id="${id}"]`).first();
  await expect(row('finished')).toHaveClass(/\bdone\b/);
  await expect(row('late')).not.toHaveClass(/\bdone\b/);
  expect(await row('finished').locator('.todo-title').first().evaluate(el => getComputedStyle(el).textDecorationLine)).toBe('line-through');
  await expect(row('late').locator('.todo-due').first()).toHaveClass(/\boverdue\b/);
  await expect(row('soon').locator('.todo-due').first()).not.toHaveClass(/\boverdue\b/);
});

test('the add row adds a root todo with the default bounty and a due date a week out', async ({ page }) => {
  await openPage(page);
  const title = page.getByRole('textbox', { name: 'New todo title' });
  await expect(page.getByRole('textbox', { name: 'New todo bounty' })).toHaveValue('2');
  await expect(page.getByLabel('New todo due date', { exact: true })).toHaveValue('2026-10-28');

  await page.getByRole('button', { name: 'Add', exact: true }).click();
  expect(await gsdTodos(page)).toHaveLength(4);

  await title.fill('Plan trip');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(title).toHaveValue('');
  let todos = await gsdTodos(page);
  expect(todos[4]).toMatchObject({ title: 'Plan trip', bounty: 2, due: '2026-10-28', created: '2026-10-21', children: [] });

  await title.fill('No rush');
  await page.getByRole('textbox', { name: 'New todo bounty' }).fill('4');
  await page.getByRole('button', { name: 'Clear new todo due date' }).click();
  await title.press('Enter');
  todos = await gsdTodos(page);
  expect(todos[5]).toMatchObject({ title: 'No rush', bounty: 4 });
  expect(todos[5]).not.toHaveProperty('due');
});

test('ticking marks done today, the done date moves earlier, and blocked ticks say why', async ({ page }) => {
  await openPage(page);
  const soon = page.getByRole('checkbox', { name: 'Done: Taxes — finish its Nudges first' });
  await expect(soon).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: 'Done: Find bags — its parent is done' })).toBeDisabled();

  await page.getByRole('checkbox', { name: 'Done: Dentist', exact: true }).check();
  expect(findTodo(await gsdTodos(page), 'late')?.done).toBe('2026-10-21');
  const doneOn = page.getByLabel('Done on: Dentist');
  await expect(doneOn).toHaveValue('2026-10-21');
  await expect(doneOn).toHaveAttribute('min', '2026-10-01');
  await expect(doneOn).toHaveAttribute('max', '2026-10-21');
  await doneOn.fill('2026-10-14');
  await expect.poll(async () => findTodo(await gsdTodos(page), 'late')?.done).toBe('2026-10-14');

  await page.getByRole('checkbox', { name: 'Done: Find forms', exact: true }).check();
  await expect(page.getByRole('checkbox', { name: 'Done: Taxes', exact: true })).toBeEnabled();
  await page.getByRole('checkbox', { name: 'Done: Taxes', exact: true }).check();
  expect(findTodo(await gsdTodos(page), 'soon')?.done).toBe('2026-10-21');
  await expect(page.getByRole('checkbox', { name: 'Done: Find forms — its parent is done' })).toBeDisabled();

  await page.getByRole('checkbox', { name: 'Done: Taxes', exact: true }).uncheck();
  expect(findTodo(await gsdTodos(page), 'soon')).not.toHaveProperty('done');
});

test('Nudge adds a child inline, and is not offered on a done todo', async ({ page }) => {
  await openPage(page);
  await expect(page.getByRole('button', { name: 'Nudge Bins' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Nudge Dentist' }).click();
  const input = page.getByRole('textbox', { name: 'Smallest next step for Dentist' });
  await expect(input).toBeFocused();
  await input.fill('Find the number');
  await input.press('Enter');
  const late = findTodo(await gsdTodos(page), 'late')!;
  expect(late.children).toHaveLength(1);
  expect(late.children[0]).toMatchObject({ title: 'Find the number', bounty: 0.5, due: '2026-10-15', created: '2026-10-21' });
  await expect(input).toHaveCount(0);
  await expect(tree(page).locator(`li[data-id="${late.children[0].id}"] .todo-bounty`)).toHaveText('0.5');

  await page.getByRole('button', { name: 'Nudge Dentist' }).click();
  await page.getByRole('textbox', { name: 'Smallest next step for Dentist' }).fill('Never mind');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('textbox', { name: 'Smallest next step for Dentist' })).toHaveCount(0);
  expect(findTodo(await gsdTodos(page), 'late')?.children).toHaveLength(1);
});

test('edits title, root bounty and due date; a Nudge bounty is fixed', async ({ page }) => {
  await openPage(page);
  const title = page.getByRole('textbox', { name: 'Title: Dentist' });
  await title.fill('Dentist checkup');
  await title.press('Enter');
  await expect.poll(async () => findTodo(await gsdTodos(page), 'late')?.title).toBe('Dentist checkup');

  const bounty = page.getByRole('textbox', { name: 'Bounty: Taxes' });
  await bounty.fill('5');
  await bounty.press('Enter');
  await expect.poll(async () => findTodo(await gsdTodos(page), 'soon')?.bounty).toBe(5);
  await expect(page.getByRole('textbox', { name: 'Bounty: Find forms' })).toHaveCount(0);

  await page.getByLabel('Due: Taxes', { exact: true }).fill('2026-11-02');
  await expect.poll(async () => findTodo(await gsdTodos(page), 'soon')?.due).toBe('2026-11-02');
  await page.getByRole('button', { name: 'Clear due date: Taxes' }).click();
  await expect.poll(async () => findTodo(await gsdTodos(page), 'soon')?.due).toBeUndefined();
});

test('promote moves a Nudge up, and focus follows', async ({ page }) => {
  await openPage(page);
  await expect(page.getByRole('button', { name: 'Promote Taxes' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Promote Find forms' }).click();
  let todos = await gsdTodos(page);
  expect(todos.map(t => t.id)).toEqual(['undated', 'finished', 'soon', 'step', 'late']);
  expect(findTodo(todos, 'step')?.bounty).toBe(2);
  await expect(page.getByRole('textbox', { name: 'Title: Find forms' })).toBeFocused();
});

test('cancel sinks a todo and its Nudges below the done ones, and Restore brings it back', async ({ page }) => {
  await openPage(page);
  await expect(page.getByRole('button', { name: /^Delete / })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cancel Taxes' }).click();
  const soon = findTodo(await gsdTodos(page), 'soon');
  expect(soon?.cancelled).toBe('2026-10-21');
  expect(soon?.children[0]).not.toHaveProperty('cancelled');
  await expect(page.getByRole('textbox', { name: 'Title: Taxes' })).toBeFocused();
  await expect.poll(() => titleValues(page)).toEqual(['Dentist', 'Someday', 'Bins', 'Find bags', 'Taxes', 'Find forms']);

  const row = tree(page).locator('li[data-id="soon"]');
  await expect(row).toHaveClass(/\bcancelled\b/);
  await expect(row.locator('.todo-cancelled-note').first()).toHaveText('Cancelled');
  expect(await row.locator('.todo-title').first().evaluate(el => getComputedStyle(el).fontStyle)).toBe('italic');
  expect(await row.locator('.todo-title').first().evaluate(el => getComputedStyle(el).textDecorationLine)).toBe('none');
  await expect(page.getByRole('checkbox', { name: 'Done: Taxes — it is cancelled' })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'Title: Taxes' })).toHaveAttribute('readonly', '');
  for (const name of ['Nudge Taxes', 'Cancel Taxes', 'Nudge Find forms', 'Promote Find forms', 'Cancel Find forms', 'Restore Find forms', 'Delete Find forms']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole('button', { name: 'Restore Taxes' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete Taxes' })).toBeVisible();

  // Its points are gone: 10-03 held only Taxes' creation point; 10-19 only its Nudge's.
  await page.locator('.todo-page .cell[data-key="2026-10-03"]').hover();
  await expect(page.locator('.todo-page .detail-number')).toHaveText('Created 0 · Finished 0 · Due 0 · +0.0 points');
  await page.getByRole('heading', { name: 'Chores', level: 2 }).click();

  await page.getByRole('button', { name: 'Restore Taxes' }).click();
  expect(findTodo(await gsdTodos(page), 'soon')).not.toHaveProperty('cancelled');
  await expect(page.getByRole('textbox', { name: 'Title: Taxes' })).toBeFocused();
  await expect.poll(() => titleValues(page)).toEqual(['Dentist', 'Taxes', 'Find forms', 'Someday', 'Bins', 'Find bags']);
});

test('a cancelled Nudge stops blocking its parent', async ({ page }) => {
  await openPage(page);
  await page.getByRole('button', { name: 'Cancel Find forms' }).click();
  await expect(page.getByRole('checkbox', { name: 'Done: Taxes', exact: true })).toBeEnabled();
  await expect.poll(() => titleValues(page)).toEqual(['Dentist', 'Taxes', 'Find forms', 'Someday', 'Bins', 'Find bags']);
  await expect(page.getByRole('button', { name: 'Restore Find forms' })).toBeVisible();
});

test('Delete removes a cancelled todo after a confirm, and keeps it when dismissed', async ({ page }) => {
  await openPage(page);
  await page.getByRole('button', { name: 'Cancel Bins' }).click();
  const messages: string[] = [];
  page.once('dialog', dialog => { messages.push(dialog.message()); void dialog.dismiss(); });
  await page.getByRole('button', { name: 'Delete Bins' }).click();
  expect(messages).toEqual(['Permanently delete "Bins" and its 1 Nudge? This cannot be undone.']);
  expect(findTodo(await gsdTodos(page), 'finished')).not.toBeNull();

  page.once('dialog', dialog => { messages.push(dialog.message()); void dialog.accept(); });
  await page.getByRole('button', { name: 'Delete Bins' }).click();
  await expect.poll(async () => findTodo(await gsdTodos(page), 'finished')).toBeNull();
  expect(findTodo(await gsdTodos(page), 'fstep')).toBeNull();
  await expect(page.getByRole('textbox', { name: 'New todo title' })).toBeFocused();

  await page.getByRole('button', { name: 'Cancel Someday' }).click();
  page.once('dialog', dialog => { messages.push(dialog.message()); void dialog.accept(); });
  await page.getByRole('button', { name: 'Delete Someday' }).click();
  expect(messages[2]).toBe('Permanently delete "Someday"? This cannot be undone.');
});

test('a todo with Nudges collapses and expands them', async ({ page }) => {
  await openPage(page);
  const toggle = page.getByRole('button', { name: 'Nudges of Taxes' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('textbox', { name: 'Title: Find forms' })).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('textbox', { name: 'Title: Find forms' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Nudges of Dentist' })).toHaveCount(0);
  await toggle.click();
  await expect(page.getByRole('textbox', { name: 'Title: Find forms' })).toBeVisible();
});

test('clicking a day filters the tree, with ancestors, until cleared', async ({ page }) => {
  await openPage(page);
  const day = (key: string) => page.locator(`.todo-page .cell[data-key="${key}"]`);

  // 10-19: `step` was created; its parent `soon` shows for context.
  await day('2026-10-19').click();
  await expect.poll(() => titleValues(page)).toEqual(['Taxes', 'Find forms']);
  await expect(page.locator('.todo-filter')).toContainText('Mon, Oct 19, 2026');
  await day('2026-10-19').click();
  await expect(titles(page)).toHaveCount(6);

  // 10-09: `finished` was done. 10-15: `late` is due.
  await day('2026-10-09').click();
  await expect.poll(() => titleValues(page)).toEqual(['Bins']);
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(titles(page)).toHaveCount(6);

  await day('2026-10-15').click();
  await expect.poll(() => titleValues(page)).toEqual(['Dentist']);
  await page.getByRole('heading', { name: 'Chores', level: 2 }).click();
  await expect(titles(page)).toHaveCount(6);
  await expect(page.locator('.todo-filter')).toHaveCount(0);
});
