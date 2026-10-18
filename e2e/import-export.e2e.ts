/**
 * Executes `specs/03-02-T00-import-export.md`, cases 1–14, per
 * `specs/05-02-browser-tier.md`. That suite is the source of truth; each test names its case.
 *
 * The suite's Preparation says to build the fixtures by hand in the app. They are seeded instead:
 * the same end state, reached deterministically. Everything the cases actually exercise still goes
 * through the real surface — exports through the download, imports through the file input, and every
 * disposition through the modal's own controls.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  EXPORT_KEY,
  importFile,
  exportToText,
  open,
  readKey,
  readState,
  reopen,
  seed,
  seedState,
  CURRENT_STORAGE_VERSION,
} from './harness';

/** The fixture colors. `DEFAULT_COLOR` stands in for "color left at default". */
const DEFAULT_COLOR = '#40c463';
const IMPORT_COLOR = '#216e39';

/** Seeds are written in the store's own canonical shape, so loading rewrites nothing. */
const SEED_VERSION = 5;

/** A local date key `offset` days from today, matching `utils.dateKey`. */
function dayKey(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * The Preparation fixture set. Its counted days sit on today and the two days before so the score
 * chart's 28-day range covers them — Case 2 asserts that chart.
 */
function fixtureState() {
  return {
    version: SEED_VERSION,
    theme: 'light',
    chartRange: '28d',
    calendars: [
      {
        id: 'fx-wins',
        name: '😱 Wins',
        color: DEFAULT_COLOR,
        days: { [dayKey(-1)]: 1, [dayKey(0)]: 2 },
        activityValue: 1,
        updatedAt: '2025-05-10T00:00:00.000Z',
      },
      {
        id: 'fx-skipped',
        name: 'Skipped',
        color: '#d73a49',
        days: { [dayKey(0)]: 1 },
        activityValue: -2.5,
        updatedAt: '2025-05-11T00:00:00.000Z',
      },
      {
        id: 'fx-retired',
        name: 'Retired',
        color: '#8957e5',
        days: { [dayKey(-2)]: 4 },
        activityValue: 1,
        updatedAt: '2025-05-12T00:00:00.000Z',
        deleted: true,
      },
    ],
  };
}

/** The collision fixture's Live state: an app holding only `😱 Wins`. */
function collisionState() {
  return {
    version: SEED_VERSION,
    theme: 'light',
    chartRange: '28d',
    calendars: [
      {
        id: 'live-wins',
        name: '😱 Wins',
        color: DEFAULT_COLOR,
        days: { '2025-05-01': 3, '2025-05-02': 1 },
        activityValue: 1,
        updatedAt: '2025-05-02T00:00:00.000Z',
      },
    ],
  };
}

/** The collision fixture's Payload, reusing the live `id` read back from storage. */
function collisionPayload(version: number, liveId: string): string {
  return JSON.stringify({
    version,
    exportedAt: '2025-06-01T12:00:00.000Z',
    calendars: [
      {
        id: liveId,
        name: 'Imported Wins',
        color: IMPORT_COLOR,
        days: { '2025-05-02': 5, '2025-05-03': 2 },
        activityValue: 2,
        updatedAt: '2025-06-01T12:00:00.000Z',
      },
    ],
  });
}

/** Seed the Live state, open, and return the live calendar's `id` as stored. */
async function openCollisionFixture(page: Page): Promise<{ liveId: string; payload: string }> {
  await seedState(page, collisionState());
  await open(page);
  const stored = await readState(page);
  const liveId: string = stored.calendars[0].id;
  return { liveId, payload: collisionPayload(CURRENT_STORAGE_VERSION, liveId) };
}

function dialog(page: Page): Locator {
  return page.getByRole('dialog');
}

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** One review row, found by the calendar name its accessible name starts with. */
function row(page: Page, name: string): Locator {
  return dialog(page).getByRole('listitem', { name: new RegExp(`^${escapeRe(name)},`) });
}

/** A row is rejected exactly when it carries the skipped tag. */
function skippedTag(rowLocator: Locator): Locator {
  return rowLocator.locator('.import-modal-skipped-tag');
}

/** Click Apply and wait for the single write the modal's close represents. */
async function apply(page: Page): Promise<void> {
  await dialog(page).getByRole('button', { name: 'Apply' }).click();
  await expect(dialog(page)).toHaveCount(0);
}

async function cancel(page: Page): Promise<void> {
  await dialog(page).getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog(page)).toHaveCount(0);
}

/** The fields a case compares; `updatedAt` and `deleted` are asserted where a case names them. */
function identity(cal: Record<string, unknown>) {
  return {
    id: cal.id,
    name: cal.name,
    color: cal.color,
    days: cal.days,
    activityValue: cal.activityValue,
  };
}

/* ── Case 1 ──────────────────────────────────────────────────────────────── */

test('Case 1 — a full export round-trips through an emptied app', async ({ page }) => {
  // Built once: every later comparison is against this same object, so a midnight crossing
  // mid-test cannot make the expectation disagree with the fixture that was seeded.
  const fixture = fixtureState();
  await seedState(page, fixture);
  await open(page);

  // Nothing has ever been exported, so the backup reminder is showing. Asserting it HERE is what
  // makes its absence in step 4 mean the export removed it, rather than it never having been there.
  await expect(page.locator('.backup-banner')).toBeVisible();

  // Steps 1-2: exported through the header, and plain readable JSON rather than base64.
  const exported = await exportToText(page);
  expect(exported.trimStart().startsWith('{')).toBe(true);
  const envelope = JSON.parse(exported);
  expect(Object.keys(envelope)).toEqual(['version', 'exportedAt', 'calendars']);
  expect(envelope.version).toBe(CURRENT_STORAGE_VERSION);
  expect(typeof envelope.exportedAt).toBe('string');

  // Step 3: all three fixtures, `Retired` included — a backup is complete.
  expect(envelope.calendars.map((cal: { name: string }) => cal.name)).toEqual([
    '😱 Wins',
    'Skipped',
    'Retired',
  ]);
  expect(envelope.calendars[2].deleted).toBe(true);

  // Step 4: the export timestamp is recorded and the backup banner goes.
  const stamp = await readKey(page, EXPORT_KEY);
  expect(stamp).not.toBeNull();
  expect(Date.now() - Number.parseInt(stamp as string, 10)).toBeLessThan(60_000);
  await expect(page.locator('.backup-banner')).toHaveCount(0);

  // Step 5: every `achievement-calendars*` key gone, and the app reloads empty.
  await seed(page, {});
  await reopen(page);
  await expect(page.locator('.empty-state')).toBeVisible();
  expect(await page.evaluate(() => window.__store!.calendars.length)).toBe(0);

  // Step 6: three rows, all accepted, none carrying a dropdown — nothing collides.
  await importFile(page, 'calendars.json', exported);
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page).getByRole('listitem')).toHaveCount(3);
  await expect(dialog(page).locator('.import-modal-skipped-tag')).toHaveCount(0);
  await expect(dialog(page).getByRole('combobox')).toHaveCount(0);

  // Step 7: all three return intact.
  await apply(page);
  const stored = await readState(page);
  expect(stored.calendars.map(identity)).toEqual(fixture.calendars.map(identity));

  // Step 8: every row was an append, and an appended calendar lands undeleted.
  expect(stored.calendars.some((cal: { deleted?: boolean }) => cal.deleted !== undefined)).toBe(
    false,
  );
  expect(await page.evaluate(() => window.__store!.deletedCalendars.length)).toBe(0);
  await expect(page.locator('.recover-toggle')).toHaveCount(0);
});

/* ── Case 2 ──────────────────────────────────────────────────────────────── */

test('Case 2 — emoji names and negative activity values survive a round trip', async ({ page }) => {
  const nativeDialogs: string[] = [];
  page.on('dialog', d => {
    nativeDialogs.push(d.message());
    void d.dismiss();
  });

  await seedState(page, fixtureState());
  await open(page);

  // Steps 1-2: the raw file carries the emoji name and the negative value verbatim.
  const exported = await exportToText(page);
  expect(exported).toContain('😱 Wins');
  expect(exported).toContain('"activityValue":-2.5');
  expect(nativeDialogs).toEqual([]);
  // "Verify no error" is also a claim about the inline channel, not only the native one.
  await expect(page.locator('.banner-region .import-status')).toHaveText('');

  // Step 3: into an empty app.
  await seed(page, {});
  await reopen(page);
  await importFile(page, 'calendars.json', exported);

  // Step 4: the emoji renders identically in the row, and then on the card.
  await expect(row(page, '😱 Wins').locator('.import-modal-name')).toHaveText('😱 Wins');
  await apply(page);
  await expect(page.locator('.cal-name-input').first()).toHaveValue('😱 Wins');

  // Step 5: `Skipped`'s activity value, unchanged in sign and precision.
  const skippedCard = page.locator('.cal-card').nth(1);
  await expect(skippedCard.locator('.cal-name-input')).toHaveValue('Skipped');
  await skippedCard.getByRole('button', { name: 'Calendar actions' }).click();
  await expect(skippedCard.locator('.value-input')).toHaveValue('-2.5');

  // Step 6: today's column carries `😱 Wins`'s +2.0 against `Skipped`'s -2.5.
  const todayColumn = page.locator('.score-bar-col').last();
  await expect(todayColumn.locator('.score-bar-hit')).toHaveAttribute(
    'aria-label',
    /\+2\.0 -2\.5 → net -0\.5$/,
  );
  await expect(todayColumn.locator('.score-total-neg')).toBeVisible();
  expect(nativeDialogs).toEqual([]);
});

/* ── Case 3 ──────────────────────────────────────────────────────────────── */

test('Case 3 — legacy bare-array and single-object payloads import', async ({ page }) => {
  await seed(page, {});
  await open(page);

  const bareArray = JSON.stringify([
    {
      id: 'legacy-a',
      name: 'Walks',
      color: '#40c463',
      days: { '2025-05-02': 4 },
      activityValue: 1,
    },
    {
      id: 'legacy-b',
      name: 'Naps',
      color: '#216e39',
      days: { '2025-05-03': 1 },
      activityValue: 0.5,
    },
  ]);

  // Step 2: both calendars are listed, then applied.
  await importFile(page, 'legacy-array.json', bareArray);
  await expect(dialog(page).getByRole('listitem')).toHaveCount(2);
  await apply(page);

  // Step 3: both active, with their counts and activity values.
  const afterArray = await readState(page);
  expect(afterArray.calendars.map(identity)).toEqual([
    {
      id: 'legacy-a',
      name: 'Walks',
      color: '#40c463',
      days: { '2025-05-02': 4 },
      activityValue: 1,
    },
    {
      id: 'legacy-b',
      name: 'Naps',
      color: '#216e39',
      days: { '2025-05-03': 1 },
      activityValue: 0.5,
    },
  ]);
  expect(await page.evaluate(() => window.__store!.deletedCalendars.length)).toBe(0);

  // Step 4: a legacy payload is stored at the current version.
  expect(afterArray.version).toBe(CURRENT_STORAGE_VERSION);

  // Step 5: the same file holding one calendar object rather than an array.
  await seed(page, {});
  await reopen(page);
  const single = JSON.stringify({
    id: 'legacy-c',
    name: 'Stretches',
    color: '#216e39',
    days: { '2025-05-04': 2 },
    activityValue: 1.5,
  });
  await importFile(page, 'legacy-single.json', single);
  await expect(dialog(page).getByRole('listitem')).toHaveCount(1);
  await apply(page);

  const afterSingle = await readState(page);
  expect(afterSingle.calendars.map(identity)).toEqual([
    {
      id: 'legacy-c',
      name: 'Stretches',
      color: '#216e39',
      days: { '2025-05-04': 2 },
      activityValue: 1.5,
    },
  ]);
  expect(afterSingle.version).toBe(CURRENT_STORAGE_VERSION);
});

/* ── Cases 4-7: the four merge actions on one colliding row ──────────────── */

test('Case 4 — a colliding row merged as replace', async ({ page }) => {
  const { liveId, payload } = await openCollisionFixture(page);
  const before = (await readState(page)).calendars[0].updatedAt;

  // Step 1: one row, rejected by default, offering skip plus exactly the four merge actions —
  // there is no keep-the-live-calendar action, because rejection already is that outcome.
  await importFile(page, 'collision.json', payload);
  const collidingRow = row(page, 'Imported Wins');
  await expect(collidingRow).toBeVisible();
  await expect(skippedTag(collidingRow)).toBeVisible();
  const select = collidingRow.getByRole('combobox');
  await expect(select).toHaveValue('skip');
  expect(
    await select.locator('option').evaluateAll(options =>
      options.map(option => (option as HTMLOptionElement).value),
    ),
  ).toEqual(['skip', 'replace', 'merge-by-sum', 'merge-prefer-import', 'merge-prefer-live']);

  // Step 2: choosing a merge action un-rejects the row.
  await select.selectOption('replace');
  await expect(skippedTag(collidingRow)).toHaveCount(0);

  await apply(page);

  // Steps 4-7.
  const stored = await readState(page);
  expect(stored.calendars).toHaveLength(1);
  expect(stored.calendars[0].id).toBe(liveId);
  expect(stored.calendars[0].days).toEqual({ '2025-05-02': 5, '2025-05-03': 2 });
  expect(stored.calendars[0].name).toBe('Imported Wins');
  expect(stored.calendars[0].color).toBe(IMPORT_COLOR);
  expect(stored.calendars[0].activityValue).toBe(2);
  expect(stored.calendars[0].updatedAt > before).toBe(true);
});

test('Case 5 — a colliding row merged as merge-by-sum', async ({ page }) => {
  const { liveId, payload } = await openCollisionFixture(page);
  const before = (await readState(page)).calendars[0].updatedAt;

  await importFile(page, 'collision.json', payload);
  await row(page, 'Imported Wins').getByRole('combobox').selectOption('merge-by-sum');
  await apply(page);

  const stored = await readState(page);
  expect(stored.calendars).toHaveLength(1);
  expect(stored.calendars[0].id).toBe(liveId);
  expect(stored.calendars[0].days).toEqual({
    '2025-05-01': 3,
    '2025-05-02': 6,
    '2025-05-03': 2,
  });
  // Summing is about history: the live metadata stands.
  expect(stored.calendars[0].name).toBe('😱 Wins');
  expect(stored.calendars[0].color).toBe(DEFAULT_COLOR);
  expect(stored.calendars[0].activityValue).toBe(1);
  expect(stored.calendars[0].updatedAt > before).toBe(true);
});

test('Case 6 — a colliding row merged as merge-prefer-import', async ({ page }) => {
  const { liveId, payload } = await openCollisionFixture(page);
  const before = (await readState(page)).calendars[0].updatedAt;

  await importFile(page, 'collision.json', payload);
  await row(page, 'Imported Wins').getByRole('combobox').selectOption('merge-prefer-import');
  await apply(page);

  const stored = await readState(page);
  expect(stored.calendars).toHaveLength(1);
  expect(stored.calendars[0].id).toBe(liveId);
  expect(stored.calendars[0].days).toEqual({
    '2025-05-01': 3,
    '2025-05-02': 5,
    '2025-05-03': 2,
  });
  expect(stored.calendars[0].name).toBe('Imported Wins');
  expect(stored.calendars[0].color).toBe(IMPORT_COLOR);
  expect(stored.calendars[0].activityValue).toBe(2);
  expect(stored.calendars[0].updatedAt > before).toBe(true);
});

test('Case 7 — a colliding row merged as merge-prefer-live', async ({ page }) => {
  const { liveId, payload } = await openCollisionFixture(page);
  const before = (await readState(page)).calendars[0].updatedAt;

  await importFile(page, 'collision.json', payload);
  await row(page, 'Imported Wins').getByRole('combobox').selectOption('merge-prefer-live');
  await apply(page);

  const stored = await readState(page);
  expect(stored.calendars).toHaveLength(1);
  expect(stored.calendars[0].id).toBe(liveId);
  expect(stored.calendars[0].days).toEqual({
    '2025-05-01': 3,
    '2025-05-02': 1,
    '2025-05-03': 2,
  });
  expect(stored.calendars[0].name).toBe('😱 Wins');
  expect(stored.calendars[0].color).toBe(DEFAULT_COLOR);
  expect(stored.calendars[0].activityValue).toBe(1);
  expect(stored.calendars[0].updatedAt > before).toBe(true);
});

/* ── Case 8 ──────────────────────────────────────────────────────────────── */

test('Case 8 — a colliding row left at its rejected default writes nothing', async ({ page }) => {
  const { payload } = await openCollisionFixture(page);

  // Step 1: the stored string as the app itself wrote it, which is the byte-for-byte baseline.
  const before = await readKey(page, 'achievement-calendars');

  // Steps 2-3: touch nothing, Apply.
  await importFile(page, 'collision.json', payload);
  await expect(skippedTag(row(page, 'Imported Wins'))).toBeVisible();
  await apply(page);

  // Steps 4-5: byte-for-byte what it was, `updatedAt` included, and no second calendar.
  expect(await readKey(page, 'achievement-calendars')).toBe(before);
  expect((await readState(page)).calendars).toHaveLength(1);
});

/* ── Case 9 ──────────────────────────────────────────────────────────────── */

test('Case 9 — a review row shows name, event count and last update', async ({ page }) => {
  const { payload } = await openCollisionFixture(page);
  const version = CURRENT_STORAGE_VERSION;

  // Steps 1-3: the payload's own name, the sum of its day counts (5 + 2), and its `updatedAt`.
  await importFile(page, 'collision.json', payload);
  const collidingRow = row(page, 'Imported Wins');
  await expect(collidingRow.locator('.import-modal-name')).toHaveText('Imported Wins');
  await expect(collidingRow.locator('.import-modal-events')).toHaveText('7');
  await expect(collidingRow.locator('.import-modal-updated')).toHaveText('2025-06-01');

  // Step 4: a calendar with no counted days reads `0` events.
  await cancel(page);
  await importFile(
    page,
    'empty-days.json',
    JSON.stringify({
      version,
      exportedAt: '2025-06-02T00:00:00.000Z',
      calendars: [
        {
          id: 'no-days',
          name: 'Blank',
          color: IMPORT_COLOR,
          days: {},
          activityValue: 1,
          updatedAt: '2025-06-02T00:00:00.000Z',
        },
      ],
    }),
  );
  await expect(row(page, 'Blank').locator('.import-modal-events')).toHaveText('0');
});

/* ── Case 10 ─────────────────────────────────────────────────────────────── */

test('Case 10 — rejecting a non-colliding row imports nothing for it', async ({ page }) => {
  await seedState(page, collisionState());
  await open(page);
  const version = CURRENT_STORAGE_VERSION;

  const payload = JSON.stringify({
    version,
    exportedAt: '2025-06-03T00:00:00.000Z',
    calendars: [
      {
        id: 'keeper',
        name: 'Keeper',
        color: IMPORT_COLOR,
        days: { '2025-05-05': 2 },
        activityValue: 1,
        updatedAt: '2025-06-03T00:00:00.000Z',
      },
      {
        id: 'unwanted',
        name: 'Unwanted',
        color: IMPORT_COLOR,
        days: { '2025-05-06': 1 },
        activityValue: 1,
        updatedAt: '2025-06-03T00:00:00.000Z',
      },
    ],
  });

  // Step 3: nothing collides, so both rows are accepted and neither carries a dropdown.
  await importFile(page, 'two-new.json', payload);
  await expect(dialog(page).getByRole('listitem')).toHaveCount(2);
  await expect(dialog(page).locator('.import-modal-skipped-tag')).toHaveCount(0);
  await expect(dialog(page).getByRole('combobox')).toHaveCount(0);

  // Step 4: reject `Unwanted` through its own control.
  await row(page, 'Unwanted').getByRole('checkbox').check();
  await expect(skippedTag(row(page, 'Unwanted'))).toBeVisible();
  await expect(skippedTag(row(page, 'Keeper'))).toHaveCount(0);
  await apply(page);

  const stored = await readState(page);
  expect(stored.calendars.map((cal: { id: string }) => cal.id)).toEqual(['live-wins', 'keeper']);
  // Not in the list, not in trash, not under any id.
  expect(await readKey(page, 'achievement-calendars')).not.toContain('unwanted');
  expect(await page.evaluate(() => window.__store!.deletedCalendars.length)).toBe(0);
});

/* ── Case 11 ─────────────────────────────────────────────────────────────── */

test('Case 11 — an appended calendar lands undeleted', async ({ page }) => {
  await seed(page, {});
  await open(page);
  const version = CURRENT_STORAGE_VERSION;

  await importFile(
    page,
    'deleted-source.json',
    JSON.stringify({
      version,
      exportedAt: '2025-06-04T00:00:00.000Z',
      calendars: [
        {
          id: 'from-trash',
          name: 'From trash',
          color: IMPORT_COLOR,
          days: { '2025-05-07': 1 },
          activityValue: 1,
          updatedAt: '2025-06-04T00:00:00.000Z',
          deleted: true,
        },
      ],
    }),
  );
  await expect(skippedTag(row(page, 'From trash'))).toHaveCount(0);
  await apply(page);

  const stored = await readState(page);
  expect(stored.calendars[0].deleted).toBeUndefined();
  expect(await page.evaluate(() => window.__store!.activeCalendars.length)).toBe(1);
  expect(await page.evaluate(() => window.__store!.deletedCalendars.length)).toBe(0);
  await expect(page.locator('.recover-toggle')).toHaveCount(0);
});

/* ── Case 12 ─────────────────────────────────────────────────────────────── */

/**
 * The Case 12 payload: three ids reused from the fixtures, plus one that matches nothing.
 * `today` is passed in rather than recomputed, so one test uses one day key throughout.
 */
function mixedPayload(version: number, today: string): string {
  return JSON.stringify({
    version,
    exportedAt: '2025-06-05T00:00:00.000Z',
    calendars: [
      {
        id: 'fx-wins',
        name: 'Wins Imported',
        color: IMPORT_COLOR,
        days: { '2026-01-01': 9 },
        activityValue: 3,
        updatedAt: '2025-06-05T00:00:00.000Z',
      },
      {
        id: 'fx-skipped',
        name: 'Skipped Imported',
        color: IMPORT_COLOR,
        days: { '2026-01-02': 1, [today]: 4 },
        activityValue: -7,
        updatedAt: '2025-06-05T00:00:00.000Z',
      },
      {
        id: 'fx-retired',
        name: 'Retired Imported',
        color: IMPORT_COLOR,
        days: { '2026-01-03': 2 },
        activityValue: 5,
        updatedAt: '2025-06-05T00:00:00.000Z',
      },
      {
        id: 'fx-extra',
        name: 'Extra',
        color: IMPORT_COLOR,
        days: { '2026-01-04': 6 },
        activityValue: 1,
        updatedAt: '2025-06-05T00:00:00.000Z',
      },
    ],
  });
}

test('Case 12 — a mixed payload resolves row by row', async ({ page }) => {
  // One day key for the whole test: the payload's and the assertion's must be the same string.
  const today = dayKey(0);
  await seedState(page, fixtureState());
  await open(page);
  const payload = mixedPayload(CURRENT_STORAGE_VERSION, today);

  // Step 1: the live ids, the live `updatedAt` values, and the exact stored bytes of `Retired`.
  //
  // The byte-for-byte baseline is cut out of the RAW stored string, as Cases 8 and 14 take theirs.
  // Re-serializing a parsed object is what `05-02-browser-tier.md` forbids: it would agree with a
  // payload the app had rewritten in some other shape, which is the failure being watched for.
  const beforeState = await readState(page);
  const beforeRaw = (await readKey(page, 'achievement-calendars')) as string;
  const retiredStart = beforeRaw.indexOf('{"id":"fx-retired"');
  expect(retiredStart).toBeGreaterThan(-1);
  const retiredBytes = beforeRaw.slice(retiredStart, beforeRaw.lastIndexOf('}]') + 1);
  const winsUpdatedAt = beforeState.calendars[0].updatedAt;
  const skippedUpdatedAt = beforeState.calendars[1].updatedAt;
  const skippedColor = beforeState.calendars[1].color;

  // Steps 3-4: four rows; the three colliding ones rejected and carrying dropdowns, the fourth
  // accepted and carrying none.
  await importFile(page, 'mixed.json', payload);
  await expect(dialog(page).getByRole('listitem')).toHaveCount(4);
  await expect(dialog(page).getByRole('combobox')).toHaveCount(3);
  for (const name of ['Wins Imported', 'Skipped Imported', 'Retired Imported']) {
    await expect(skippedTag(row(page, name))).toBeVisible();
  }
  await expect(skippedTag(row(page, 'Extra'))).toHaveCount(0);
  await expect(row(page, 'Extra').getByRole('combobox')).toHaveCount(0);

  // Step 5.
  await row(page, 'Wins Imported').getByRole('combobox').selectOption('replace');
  await row(page, 'Skipped Imported').getByRole('combobox').selectOption('merge-by-sum');
  await apply(page);

  const stored = await readState(page);
  const raw = (await readKey(page, 'achievement-calendars')) as string;

  // Step 6: each under its live id and original index, resolved as its own case specifies.
  expect(stored.calendars[0].id).toBe('fx-wins');
  expect(stored.calendars[0].days).toEqual({ '2026-01-01': 9 });
  expect(stored.calendars[0].name).toBe('Wins Imported');
  expect(stored.calendars[0].color).toBe(IMPORT_COLOR);
  expect(stored.calendars[0].activityValue).toBe(3);
  expect(stored.calendars[0].updatedAt > winsUpdatedAt).toBe(true);

  // `merge-by-sum` keeps the live metadata whole, which Case 5 asserts in full: the color is left
  // where the live calendar had it, and `updatedAt` still advances, because the days did change.
  expect(stored.calendars[1].id).toBe('fx-skipped');
  expect(stored.calendars[1].days).toEqual({ '2026-01-02': 1, [today]: 5 });
  expect(stored.calendars[1].name).toBe('Skipped');
  expect(stored.calendars[1].activityValue).toBe(-2.5);
  expect(stored.calendars[1].color).toBe(skippedColor);
  expect(stored.calendars[1].updatedAt > skippedUpdatedAt).toBe(true);

  // Step 7: the rejected row left `Retired`'s stored bytes alone, and it is still in the trash.
  expect(raw).toContain(retiredBytes);
  expect(stored.calendars[2].deleted).toBe(true);
  expect(await page.evaluate(() => window.__store!.deletedCalendars.length)).toBe(1);

  // Step 8: the non-colliding calendar appended at the end, active.
  expect(stored.calendars).toHaveLength(4);
  expect(stored.calendars[3].id).toBe('fx-extra');
  expect(stored.calendars[3].deleted).toBeUndefined();
});

/* ── Case 13 ─────────────────────────────────────────────────────────────── */

test('Case 13 — an import failure reports inline, and a success clears itself', async ({ page }) => {
  const nativeDialogs: string[] = [];
  page.on('dialog', d => {
    nativeDialogs.push(d.message());
    void d.dismiss();
  });

  await seed(page, {});
  await open(page);
  const version = CURRENT_STORAGE_VERSION;
  // Step 2 says "in the banner region below the header", so the locator is scoped to that region:
  // a status line anywhere else no longer satisfies these assertions.
  const bannerRegion = page.locator('.banner-region');
  const status = bannerRegion.getByRole('status');
  const statusLine = bannerRegion.locator('.import-status');

  // Steps 1-2: the failure lands on the status line, with no modal and no calendar added.
  await importFile(page, 'broken.json', '{ "calendars": [ ');
  await expect(status).toContainText('could not be read as calendar data');
  await expect(dialog(page)).toHaveCount(0);
  expect(nativeDialogs).toEqual([]);
  expect(await page.evaluate(() => window.__store!.calendars.length)).toBe(0);

  // Step 3: a failure carries no timer. Proving the absence of one needs real elapsed time, so
  // this waits past the success line's own 5s clear and then asserts the message still stands.
  await page.waitForTimeout(6_000);
  // Standing immediately before the superseding import: without this, the empty line asserted
  // afterwards would be equally true of a failure that had been cleared long before, or never set.
  await expect(status).toContainText('could not be read as calendar data');

  // Step 4: a valid import supersedes it, and the success clears itself after about 5s.
  await importFile(
    page,
    'good.json',
    JSON.stringify({
      version,
      exportedAt: '2025-06-06T00:00:00.000Z',
      calendars: [
        {
          id: 'good-one',
          name: 'Good',
          color: IMPORT_COLOR,
          days: { '2025-05-08': 1 },
          activityValue: 1,
          updatedAt: '2025-06-06T00:00:00.000Z',
        },
      ],
    }),
  );
  // Superseded: opening the modal clears the earlier failure. The app is `aria-hidden` while the
  // modal is open, so the same element is addressed directly rather than by role here.
  await expect(statusLine).toHaveText('');
  await expect(statusLine.locator('.import-status-text')).toHaveCount(0);
  await apply(page);
  await expect(status).toContainText('Imported 1 calendar.');

  // "After about 5 seconds" is two claims, and the one worth catching is the first: a line that
  // cleared instantly would satisfy a bare "gone within 15s" exactly as well. So the text has to
  // still stand at ~3s, and only then is its disappearance polled for, under a tighter ceiling.
  await page.waitForTimeout(3_000);
  await expect(status).toContainText('Imported 1 calendar.');

  // A cleared line is empty and `display: none`, so it leaves the accessibility tree entirely:
  // the status role going away *is* the clear.
  await expect.poll(() => status.count(), { timeout: 8_000, intervals: [250] }).toBe(0);
  await expect(statusLine).toHaveText('');
  expect(nativeDialogs).toEqual([]);
});

/* ── Case 14 ─────────────────────────────────────────────────────────────── */

/** Set up the fixtures, open the Case 12 payload's modal, and make the Case 14 choices. */
async function stageAbandonedImport(page: Page): Promise<string> {
  await seedState(page, fixtureState());
  await open(page);
  const payload = mixedPayload(CURRENT_STORAGE_VERSION, dayKey(0));
  const before = (await readKey(page, 'achievement-calendars')) as string;

  await importFile(page, 'mixed.json', payload);
  await expect(dialog(page).getByRole('listitem')).toHaveCount(4);
  await row(page, 'Wins Imported').getByRole('combobox').selectOption('replace');
  await row(page, 'Skipped Imported').getByRole('combobox').selectOption('merge-prefer-import');
  await row(page, 'Extra').getByRole('checkbox').check();
  return before;
}

/** Cancel abandons merges and appends alike, as one write that never happened. */
async function expectNothingWritten(page: Page, before: string): Promise<void> {
  await expect(dialog(page)).toHaveCount(0);
  expect(await readKey(page, 'achievement-calendars')).toBe(before);
  const stored = await readState(page);
  expect(stored.calendars).toHaveLength(3);
  expect(stored.calendars[2].deleted).toBe(true);
  expect(await page.evaluate(() => window.__store!.deletedCalendars.length)).toBe(1);
}

test('Case 14 — Cancel writes nothing', async ({ page }) => {
  const before = await stageAbandonedImport(page);
  await dialog(page).getByRole('button', { name: 'Cancel' }).click();
  await expectNothingWritten(page, before);
});

test('Case 14 — Escape writes nothing', async ({ page }) => {
  const before = await stageAbandonedImport(page);
  await page.keyboard.press('Escape');
  await expectNothingWritten(page, before);
});
