/**
 * The cross-tab and long-press cases of `specs/05-02-browser-tier.md` "Scope" — the ones the node
 * tier cannot reach, because they need real `storage` events between real tabs and real pointer
 * timing.
 *
 * Both tabs are pages of one browser context: `storage` events cross between pages on one origin.
 *
 * Each test also asserts the loop guard of `specs/02-02-state-store.md`: the reader sets
 * `lastWritten` before reconciling an incoming change, so its own save effect skips the write that
 * reconcile would otherwise provoke. A page never receives its own `storage` event, so a write-back
 * by the reader would show up as an event arriving at the WRITER — and as a second event at the
 * reader once the writer echoed it. Both counts are asserted, after a settle window long enough
 * for such an echo to have landed.
 */
import { expect, test, type Page } from '@playwright/test';
import { EXPORT_KEY, STORAGE_KEY, THEME_KEY, open, readKey, readState, seed } from './harness';

const SEED_VERSION = 5;

/** Marker key a blocked tab writes for the other tab to see. Outside the app's key prefix. */
const BLOCK_MARKER = 'x-cross-tab-blocking';

/**
 * How long to wait before asserting that NO further `storage` event arrived. A write-back by the
 * reader would be queued by the same reconcile that produced the convergence already asserted, so
 * this only has to outlast one effect flush plus the cross-page event hop.
 */
const SETTLE_MS = 500;

function dayKey(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Two empty calendars, in the store's own canonical shape and with the theme key seeded too, so a
 * tab's load writes nothing and every observed `storage` event comes from a test's own action.
 */
function twoTabState(days: Record<string, number> = {}) {
  return {
    version: SEED_VERSION,
    theme: 'light',
    chartRange: '28d',
    calendars: [
      {
        id: 'ct-wins',
        name: 'Wins',
        color: '#40c463',
        days,
        activityValue: 1,
        updatedAt: '2025-05-10T00:00:00.000Z',
      },
      {
        id: 'ct-skipped',
        name: 'Skipped',
        color: '#d73a49',
        days: {},
        activityValue: -2.5,
        updatedAt: '2025-05-11T00:00:00.000Z',
      },
    ],
  };
}

async function openSeeded(page: Page, state: unknown): Promise<void> {
  await seed(page, { [STORAGE_KEY]: JSON.stringify(state), [THEME_KEY]: 'light' });
  // The turn marker sits outside the `achievement-calendars` prefix, so the harness seed will not
  // clear it. `05-02-browser-tier.md` makes that this test's own job: a marker left over from an
  // earlier run would satisfy the blocked-write poll instantly and quietly turn "the same
  // event-loop turn" into "two writes in any order".
  await page.addInitScript(marker => localStorage.removeItem(marker), BLOCK_MARKER);
  await open(page);
}

/** Start recording `storage` events in this page, from now on. */
async function recordStorageEvents(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__crossTabSeen = [];
    window.addEventListener('storage', event => {
      window.__crossTabSeen!.push(event.key ?? '(cleared)');
    });
  });
}

async function seenKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__crossTabSeen ?? []);
}

/** How many `storage` events for `key` this page has seen. One is the whole point; two is a loop. */
async function seenCount(page: Page, key: string): Promise<number> {
  return page.evaluate(k => (window.__crossTabSeen ?? []).filter(seen => seen === k).length, key);
}

/* ── storage events between two tabs ─────────────────────────────────────── */

test('a count change in one tab lands in the other', async ({ context }) => {
  const writer = await context.newPage();
  const reader = await context.newPage();
  const state = twoTabState();
  await openSeeded(writer, state);
  await openSeeded(reader, state);
  await recordStorageEvents(writer);
  await recordStorageEvents(reader);

  const key = dayKey(0);
  await writer.locator(`.cell[data-key="${key}"]`).first().click();

  await expect
    .poll(() => reader.evaluate(k => window.__store!.calendars[0].days[k] ?? 0, key))
    .toBe(1);
  expect(await seenKeys(reader)).toContain(STORAGE_KEY);

  // Loop guard: having reconciled, the reader must not write the state key back.
  await reader.waitForTimeout(SETTLE_MS);
  expect(await seenCount(writer, STORAGE_KEY)).toBe(0);
  expect(await seenCount(reader, STORAGE_KEY)).toBe(1);
});

test('a theme change in one tab lands in the other', async ({ context }) => {
  const writer = await context.newPage();
  const reader = await context.newPage();
  const state = twoTabState();
  await openSeeded(writer, state);
  await openSeeded(reader, state);
  await recordStorageEvents(writer);
  await recordStorageEvents(reader);

  await writer.getByRole('button', { name: /^Theme:/ }).click();
  await writer.getByRole('button', { name: 'Dark', exact: true }).click();

  await expect.poll(() => reader.evaluate(() => window.__store!.theme)).toBe('dark');
  await expect(reader.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(await seenKeys(reader)).toContain(THEME_KEY);

  // Loop guard, on both keys a theme change touches: the theme signal is part of the serialized
  // envelope, so the writer writes the state key too, and the reader must echo neither.
  await reader.waitForTimeout(SETTLE_MS);
  expect(await seenCount(writer, THEME_KEY)).toBe(0);
  expect(await seenCount(writer, STORAGE_KEY)).toBe(0);
  expect(await seenCount(reader, THEME_KEY)).toBe(1);
});

test('an export in one tab lands in the other', async ({ context }) => {
  const writer = await context.newPage();
  const reader = await context.newPage();
  // Computed once: a midnight crossing mid-test must not give the fixture two different day keys.
  const key = dayKey(0);
  const state = twoTabState({ [key]: 2 });
  await openSeeded(writer, state);
  await openSeeded(reader, state);
  await recordStorageEvents(writer);
  await recordStorageEvents(reader);

  // Neither tab has ever exported, so both show the backup reminder.
  await expect(reader.locator('.backup-banner')).toBeVisible();

  const download = writer.waitForEvent('download');
  await writer.getByRole('button', { name: 'Export all calendars' }).click();
  await download;

  await expect.poll(() => reader.evaluate(() => window.__store!.lastExport)).not.toBeNull();
  await expect(reader.locator('.backup-banner')).toHaveCount(0);
  expect(await seenKeys(reader)).toContain(EXPORT_KEY);

  // Loop guard: updating the export signal must not make the reader write anything back.
  await reader.waitForTimeout(SETTLE_MS);
  expect(await seenCount(writer, EXPORT_KEY)).toBe(0);
  expect(await seenCount(writer, STORAGE_KEY)).toBe(0);
  expect(await seenCount(reader, EXPORT_KEY)).toBe(1);
});

test('two tabs writing in the same turn resolve last-write-wins', async ({ context }) => {
  const first = await context.newPage();
  const second = await context.newPage();
  const state = twoTabState();
  await openSeeded(first, state);
  await openSeeded(second, state);

  // Computed once, so a midnight crossing cannot make the two writes target different days.
  const key = dayKey(0);

  // The marker must be absent before the second tab writes it; otherwise the poll below returns
  // instantly and the two writes are no longer forced into one turn.
  expect(await readKey(first, BLOCK_MARKER)).toBeNull();
  expect(await readKey(second, BLOCK_MARKER)).toBeNull();

  /*
   * "The same event-loop turn" means the second tab writes without having handled the first tab's
   * event yet. That is forced rather than hoped for: the second tab writes a marker, then blocks its
   * own event loop with a spin, so the first tab's `storage` event can only be delivered after the
   * second tab's own write at the end of the spin. The first tab waits for the marker through shared
   * `localStorage`, so it writes strictly inside that window.
   */
  const blockedWrite = second.evaluate(
    ([calId, dateKey, marker]) => {
      localStorage.setItem(marker, 'blocking');
      const until = Date.now() + 1200;
      while (Date.now() < until) {
        /* hold this tab's event loop */
      }
      window.__store!.incrementDay(calId, dateKey);
    },
    ['ct-skipped', key, BLOCK_MARKER] as const,
  );

  await expect.poll(() => readKey(first, BLOCK_MARKER), { timeout: 10_000 }).toBe('blocking');

  /*
   * The first tab's write has to be seen LANDING, inside the blocking window, before the second
   * tab's write can be called a clobber: `[0, 1]` below is equally the outcome of a first write
   * that never happened at all. Read back in the same evaluate, one task after the mutation, so
   * the observation cannot slip past the end of the spin.
   */
  const afterFirstWrite = await first.evaluate(
    ([calId, dateKey, storageKey]) =>
      new Promise<[number, number]>(resolve => {
        window.__store!.incrementDay(calId, dateKey);
        setTimeout(() => {
          const stored = JSON.parse(localStorage.getItem(storageKey) as string);
          resolve([
            stored.calendars[0].days[dateKey] ?? 0,
            stored.calendars[1].days[dateKey] ?? 0,
          ]);
        }, 0);
      }),
    ['ct-wins', key, STORAGE_KEY] as const,
  );
  expect(afterFirstWrite).toEqual([1, 0]);

  await blockedWrite;

  // The later write is the one that stands: the first tab's increment is gone from storage.
  await expect
    .poll(async () => {
      const stored = await readState(first);
      return [stored.calendars[0].days[key] ?? 0, stored.calendars[1].days[key] ?? 0];
    })
    .toEqual([0, 1]);

  // And the tab that lost converges on the stored state rather than keeping its own.
  await expect
    .poll(() =>
      first.evaluate(
        k => [
          window.__store!.calendars[0].days[k] ?? 0,
          window.__store!.calendars[1].days[k] ?? 0,
        ],
        key,
      ),
    )
    .toEqual([0, 1]);
});

/* ── long press, with real pointer timing ────────────────────────────────── */

test('a press under the 600 ms threshold increments the day', async ({ page }) => {
  const key = dayKey(0);
  await openSeeded(page, twoTabState({ [key]: 1 }));

  await page.locator(`.cell[data-key="${key}"]`).first().hover();
  await page.mouse.down();
  await page.waitForTimeout(200);
  // The increment is on release. Asserting the seeded count is still untouched here means a
  // renderer that stalled through the press fails on this line, where the cause is visible,
  // rather than ambiguously on the one below.
  expect((await readState(page)).calendars[0].days[key] ?? 0).toBe(1);
  await page.mouse.up();

  await expect.poll(async () => (await readState(page)).calendars[0].days[key] ?? 0).toBe(2);
});

test('a press past the 600 ms threshold resets the day', async ({ page }) => {
  const key = dayKey(0);
  await openSeeded(page, twoTabState({ [key]: 3 }));

  await page.locator(`.cell[data-key="${key}"]`).first().hover();
  await page.mouse.down();
  await page.waitForTimeout(900);
  await page.mouse.up();

  // Resetting deletes the day key rather than storing a zero, and the release that follows a fired
  // long press must not also increment.
  await expect.poll(async () => (await readState(page)).calendars[0].days).toEqual({});
});

declare global {
  interface Window {
    /** Keys of the `storage` events this page has seen since recording started. */
    __crossTabSeen?: string[];
  }
}
