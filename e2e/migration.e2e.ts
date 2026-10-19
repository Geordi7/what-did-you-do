/**
 * The seven cases of `specs/03-01-T00-migration.md`, executed per
 * `specs/05-02-browser-tier.md`: seed storage in an init script, reload, verify.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  BACKUP_KEY,
  STORAGE_KEY,
  THEME_KEY,
  open,
  readKey,
  readState,
  reopen,
  seed,
  CURRENT_STORAGE_VERSION,
} from './harness';

/** The seed strings, kept as the exact strings seeded so "byte-for-byte" has a referent. */
const CASE_1_SEED = JSON.stringify({
  calendars: [
    { id: 'v0-a', name: 'Runs', days: { '2025-01-02': 3, '2025-01-05': 1 } },
    { id: 'v0-b', name: 'Retired', days: {}, deleted: true },
  ],
});

/** A local date key for today, matching `utils.dateKey`. */
function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * The Case 3 payload. Its counted day is today's, as the manual case now seeds it, so the
 * day sits inside the chart's trailing 28-day window and its negative split is readable.
 * The key is passed in and computed once per test, so a midnight crossing mid-test cannot
 * leave the seed and the assertion on different days.
 */
function case3Seed(dayKey: string): string {
  return JSON.stringify({
    version: 3,
    theme: 'light',
    calendars: [
      {
        id: 'v3-a',
        name: 'Pushups',
        color: '#216e39',
        days: { [dayKey]: 10 },
        activityValue: -2.5,
      },
    ],
  });
}

const CASE_5_SEED = JSON.stringify({
  version: 99,
  theme: 'dark',
  calendars: [
    {
      id: 'vNext-a',
      name: 'Future',
      color: '#216e39',
      days: { '2025-04-01': 1 },
      activityValue: 1,
    },
  ],
});

const CASE_7_SEED = JSON.stringify({
  version: 3,
  theme: 'light',
  calendars: [
    { id: 'dup-a', name: 'One', color: '#40c463', days: { '2025-05-01': 1 }, activityValue: 1 },
    { id: 'dup-a', name: 'Two', color: '#216e39', days: { '2025-05-02': 2 }, activityValue: 1 },
  ],
});

/** A version-4 payload; `extra` is merged into `v4-a` so a case can pre-set `updatedAt`. */
function case4Seed(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 4,
    theme: 'light',
    chartRange: '26w',
    calendars: [
      {
        id: 'v4-a',
        name: 'Swims',
        color: '#40c463',
        days: { '2025-06-02': 1, '2025-06-09': 4 },
        activityValue: 1,
        ...extra,
      },
      { id: 'v4-b', name: 'Empty', color: '#216e39', days: {}, activityValue: 1 },
    ],
  });
}

/**
 * Queue a seed of what is stored *right now*, optionally with some keys replaced.
 *
 * The harness init script clears and reseeds on every navigation, so a plain
 * `reload` would restore the original seed rather than keep the migrated state.
 * A case that reloads "without changing storage" — or that overwrites one key
 * while leaving the others alone — has to read storage back and seed that.
 */
async function reseedCurrent(page: Page, overrides: Record<string, string> = {}): Promise<void> {
  const current = await page.evaluate(() => {
    const out: Record<string, string> = {};
    for (const key of Object.keys(localStorage)) {
      const value = localStorage.getItem(key);
      if (key.startsWith('achievement-calendars') && value !== null) out[key] = value;
    }
    return out;
  });
  await seed(page, { ...current, ...overrides });
}

/** Milliseconds of slack when bracketing the migration's own clock reading. */
const CLOCK_SLACK_MS = 2000;

/** Open with the given seed, bracketing the reload instant the 4 -> 5 step stamps. */
async function openStamped(page: Page, raw: string): Promise<{ before: number; after: number }> {
  await seed(page, { [STORAGE_KEY]: raw });
  const before = Date.now();
  await open(page);
  return { before, after: Date.now() };
}

/* ── Case 1 — unversioned (0) ─────────────────────────────────────────────── */

test('Case 1: an unversioned payload migrates to the current version', async ({ page }) => {
  const { before, after } = await openStamped(page, CASE_1_SEED);

  // Step 3: one active calendar, total 4, one item in trash.
  await expect(page.locator('.cal-card')).toHaveCount(1);
  await expect(page.locator('.cal-card .cal-stat')).toHaveText('4 activities');
  await expect(page.getByRole('button', { name: /1 deleted calendar/ })).toBeVisible();
  await page.getByRole('button', { name: /1 deleted calendar/ }).click();
  await expect(page.locator('.recover-name')).toHaveText('Retired');

  // Step 4: a colour, and the default activity value.
  const active = await page.evaluate(() => window.__store!.activeCalendars[0]);
  expect(active.name).toBe('Runs');
  expect(active.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  expect(active.activityValue).toBe(1.0);

  // Step 5: envelope at the current version, order and ids kept, every calendar stamped.
  const stored = await readState(page);
  expect(stored.version).toBe(CURRENT_STORAGE_VERSION);
  expect(stored.theme).toBe('system');
  expect(stored.chartRange).toBe('28d');
  expect(stored.calendars.map((c: { id: string }) => c.id)).toEqual(['v0-a', 'v0-b']);
  for (const cal of stored.calendars) {
    expect(Date.parse(cal.updatedAt)).toBeGreaterThanOrEqual(before - CLOCK_SLACK_MS);
    expect(Date.parse(cal.updatedAt)).toBeLessThanOrEqual(after + CLOCK_SLACK_MS);
  }

  // Step 6: the snapshot is the seed verbatim.
  expect(await readKey(page, BACKUP_KEY)).toBe(CASE_1_SEED);
});

/* ── Case 2 — versions 1–2 ────────────────────────────────────────────────── */

test('Case 2: a version-2 payload keeps its theme and colour', async ({ page }) => {
  const raw = JSON.stringify({
    version: 2,
    theme: 'dark',
    calendars: [{ id: 'v2-a', name: 'Reading', color: '#40c463', days: { '2025-02-10': 2 } }],
  });
  await seed(page, { [STORAGE_KEY]: raw });
  await open(page);

  // Step 3: dark applied, and the selector says so.
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme-resolved', 'dark');
  await page.locator('header').getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('menuitemradio', { name: 'Dark', exact: true })).toHaveAttribute('aria-checked', 'true');

  // Step 4.
  const cal = await page.evaluate(() => window.__store!.activeCalendars[0]);
  expect(cal.color).toBe('#40c463');
  expect(cal.activityValue).toBe(1.0);

  // Step 5.
  const stored = await readState(page);
  expect(stored.version).toBe(CURRENT_STORAGE_VERSION);
  expect(stored.chartRange).toBe('28d');
  expect(stored.calendars[0].name).toBe('Reading');
  expect(Number.isFinite(Date.parse(stored.calendars[0].updatedAt))).toBe(true);
});

// Case 2 step 6.
test('Case 2: a version-1 payload with no theme resolves to system', async ({ page }) => {
  const raw = JSON.stringify({
    version: 1,
    calendars: [{ id: 'v2-a', name: 'Reading', color: '#40c463', days: { '2025-02-10': 2 } }],
  });
  await seed(page, { [STORAGE_KEY]: raw });
  await open(page);

  expect(await page.evaluate(() => window.__store!.theme)).toBe('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
  await page.locator('header').getByRole('button', { name: 'Menu' }).click();
  await expect(page.getByRole('menuitemradio', { name: 'System', exact: true })).toHaveAttribute('aria-checked', 'true');

  const cal = await page.evaluate(() => window.__store!.activeCalendars[0]);
  expect(cal.color).toBe('#40c463');
  expect(cal.activityValue).toBe(1.0);

  const stored = await readState(page);
  expect(stored.version).toBe(CURRENT_STORAGE_VERSION);
  expect(stored.theme).toBe('system');
  expect(stored.chartRange).toBe('28d');
  expect(Number.isFinite(Date.parse(stored.calendars[0].updatedAt))).toBe(true);
});

/* ── Case 3 — version 3 ───────────────────────────────────────────────────── */

test('Case 3: a version-3 payload keeps a negative activity value', async ({ page }) => {
  const day = todayKey();
  await seed(page, { [STORAGE_KEY]: case3Seed(day) });
  await open(page);

  // Step 3: the negative weight survives, and the chart reads today as negative
  // score — 10 counts at -2.5 is -25.0 negative, nothing positive, net -25.0.
  const cal = await page.evaluate(() => window.__store!.activeCalendars[0]);
  expect(cal.name).toBe('Pushups');
  expect(cal.activityValue).toBe(-2.5);
  expect(cal.days[day]).toBe(10);

  const todayColumn = page.locator('.score-bar-col').last();
  await expect(todayColumn.locator('.score-bar-hit')).toHaveAttribute(
    'aria-label',
    /\+0\.0 -25\.0 → net -25\.0$/,
  );
  await expect(todayColumn.locator('.score-total-neg')).toBeVisible();
  await expect(todayColumn.locator('.score-total-pos')).toHaveCount(0);
  await expect(todayColumn.locator('.score-net-down')).toBeVisible();

  // Step 4.
  const stored = await readState(page);
  expect(stored.version).toBe(CURRENT_STORAGE_VERSION);
  expect(stored.chartRange).toBe('28d');
  expect(Number.isFinite(Date.parse(stored.calendars[0].updatedAt))).toBe(true);
});

/* ── Case 4 — version 4 -> 5 ──────────────────────────────────────────────── */

test('Case 4: the 4 -> 5 step stamps every calendar with the reload instant', async ({ page }) => {
  const raw = case4Seed();
  const { before, after } = await openStamped(page, raw);

  // Step 3.
  const stored = await readState(page);
  expect(stored.version).toBe(CURRENT_STORAGE_VERSION);
  const [swims, empty] = stored.calendars;
  expect(Number.isFinite(Date.parse(swims.updatedAt))).toBe(true);
  expect(Number.isFinite(Date.parse(empty.updatedAt))).toBe(true);

  // Step 4: one calendar has counted days and the other none, and they seed alike
  // at the moment the migration ran — the dates they hold do not influence it.
  expect(swims.updatedAt).toBe(empty.updatedAt);
  expect(Date.parse(swims.updatedAt)).toBeGreaterThanOrEqual(before - CLOCK_SLACK_MS);
  expect(Date.parse(swims.updatedAt)).toBeLessThanOrEqual(after + CLOCK_SLACK_MS);

  // Step 6: the step adds a field and changes nothing else.
  expect(stored.chartRange).toBe('26w');

  // Step 7.
  expect(await readKey(page, BACKUP_KEY)).toBe(raw);

  // Step 8: already at the current version, so nothing migrates. The init script
  // reseeds on every navigation, so the CURRENT stored string is what gets queued.
  const migrated = await readKey(page, STORAGE_KEY);
  await reseedCurrent(page);
  await reopen(page);
  expect(await readKey(page, STORAGE_KEY)).toBe(migrated);
  expect(await readKey(page, BACKUP_KEY)).toBe(raw);
});

// Case 4 step 5.
test('Case 4: a pre-existing updatedAt survives and only the other is stamped', async ({ page }) => {
  const existing = '2024-01-15T09:30:00.000Z';
  const { before, after } = await openStamped(page, case4Seed({ updatedAt: existing }));

  const stored = await readState(page);
  const [swims, empty] = stored.calendars;
  expect(swims.updatedAt).toBe(existing);
  expect(Date.parse(empty.updatedAt)).toBeGreaterThanOrEqual(before - CLOCK_SLACK_MS);
  expect(Date.parse(empty.updatedAt)).toBeLessThanOrEqual(after + CLOCK_SLACK_MS);
});

/* ── Case 5 — newer version refuses to load ───────────────────────────────── */

test('Case 5: a newer version blocks and nothing is written over it', async ({ page }) => {
  await seed(page, { [STORAGE_KEY]: CASE_5_SEED });
  await open(page);

  // Step 3: the blocking message, and no calendar.
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Your saved data is from a newer version' })).toBeVisible();
  await expect(page.locator('.cal-card')).toHaveCount(0);
  expect(await page.evaluate(() => window.__store!.blocked)).toBe(true);
  expect(await page.evaluate(() => window.__store!.activeCalendars.length)).toBe(0);
  // Not a defect, so there is no diagnostic and the panel offers no controls.
  expect(await page.evaluate(() => window.__store!.diagnostic)).toBeNull();
  await expect(dialog.getByRole('button')).toHaveCount(0);

  // Step 4: the case calls for elapsed time, so that a save effect firing a tick
  // late would be caught rather than raced past. Escape is the only affordance
  // the newer-version panel has, and it is specified to do nothing.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);
  expect(await readKey(page, STORAGE_KEY)).toBe(CASE_5_SEED);
  expect(await readKey(page, BACKUP_KEY)).toBeNull();
  expect(await readKey(page, THEME_KEY)).toBeNull();

  // Step 5.
  await reseedCurrent(page);
  await reopen(page);
  await expect(page.getByRole('heading', { name: 'Your saved data is from a newer version' })).toBeVisible();
  expect(await readKey(page, STORAGE_KEY)).toBe(CASE_5_SEED);
});

/* ── Case 6 — pre-migration snapshot ──────────────────────────────────────── */

test('Case 6: the snapshot holds the pre-migration string, overwritten per migration', async ({ page }) => {
  // The Case 3 seed, computed once so both the write and the read-back below refer
  // to the same string however the clock moves mid-test.
  const case3 = case3Seed(todayKey());

  // Steps 1–2.
  await seed(page, { [STORAGE_KEY]: CASE_1_SEED });
  await open(page);
  expect(await readKey(page, BACKUP_KEY)).toBe(CASE_1_SEED);

  // Step 3: "without clearing anything" — every other key keeps its current value
  // and only the state key is overwritten, so the snapshot under test is the one
  // Case 1 left behind rather than an absent key.
  await reseedCurrent(page, { [STORAGE_KEY]: case3 });
  await reopen(page);

  // Step 4: one key, overwritten, no history.
  expect(await readKey(page, BACKUP_KEY)).toBe(case3);

  // Step 5: already at the current version, so nothing migrates and the snapshot stands.
  const migrated = await readKey(page, STORAGE_KEY);
  await reseedCurrent(page);
  await reopen(page);
  expect(await readKey(page, BACKUP_KEY)).toBe(case3);
  expect(await readKey(page, STORAGE_KEY)).toBe(migrated);
});

/* ── Case 7 — validation failure is a defect ──────────────────────────────── */

test('Case 7: a duplicate id blocks with a diagnostic and writes nothing', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await seed(page, { [STORAGE_KEY]: CASE_7_SEED });
  await open(page);

  // Step 3: blocked, no calendar, running from empty rather than from part of the seed.
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'Your saved data could not be read' })).toBeVisible();
  await expect(page.locator('.cal-card')).toHaveCount(0);
  expect(await page.evaluate(() => window.__store!.blocked)).toBe(true);
  expect(await page.evaluate(() => window.__store!.state.calendars.length)).toBe(0);

  // Steps 4–5.
  expect(await readKey(page, STORAGE_KEY)).toBe(CASE_7_SEED);
  expect(await readKey(page, BACKUP_KEY)).toBeNull();

  // Step 6: both offers, from the one payload.
  const onScreen = await dialog.locator('.blocking-diagnostic').innerText();
  await dialog.getByRole('button', { name: 'Copy diagnostic' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Diagnostic copied to the clipboard.');
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const waitForDownload = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download diagnostic' }).click();
  const download = await waitForDownload;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const downloaded = Buffer.concat(chunks).toString('utf8');
  expect(copied).toBe(onScreen);
  expect(downloaded).toBe(onScreen);

  // Step 7: what the diagnostic names, and what it must not carry.
  const target = CURRENT_STORAGE_VERSION;
  expect(downloaded).toContain('storedVersion: 3');
  expect(downloaded).toContain(`targetVersion: ${target}`);
  expect(downloaded).toContain('phase: validate');
  expect(downloaded).toContain('failingStep: none');
  expect(downloaded).toContain(`payloadBytes: ${Buffer.byteLength(CASE_7_SEED, 'utf8')}`);
  expect(downloaded).toMatch(/issues: [1-9]/);
  // One issue line per issue: a path, then the schema's own complaint. The id
  // uniqueness assertion is made over the whole envelope, so its path is the root.
  expect(downloaded).toMatch(/\n {2}\.: expected calendar ids to be unique/);
  for (const secret of ['One', 'Two', '2025-05-01', '2025-05-02']) {
    expect(downloaded).not.toContain(secret);
  }

  // Step 8.
  await reseedCurrent(page);
  await reopen(page);
  await expect(page.getByRole('heading', { name: 'Your saved data could not be read' })).toBeVisible();
  expect(await readKey(page, STORAGE_KEY)).toBe(CASE_7_SEED);
});
