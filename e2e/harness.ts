/**
 * Shared harness for the browser tier, per `specs/05-02-browser-tier.md`.
 *
 * Seeding goes through `addInitScript` so it runs before any app script on the next
 * navigation — writing storage after load would race the store's own load path.
 * Reads go through `localStorage` directly and through `window.__store`, the
 * affordance `specs/02-02-state-store.md` records for exactly this purpose.
 */
import type { Page } from '@playwright/test';
import type { Calendar, ScoringCalendar } from '../src/types';

import { STORAGE_KEY } from '../src/persistence-contract';
export { BACKUP_KEY, STORAGE_KEY, THEME_KEY, EXPORT_KEY } from '../src/persistence-contract';

/**
 * The current version, as the version log in `03-01-migrations.md` states it.
 *
 * This is a LITERAL on purpose, and importing `STORAGE_VERSION` here would defeat it.
 * Both `toStoreState` and `serialize` write the version marker straight from that
 * constant, so a test comparing the stored marker against it compares the constant
 * with itself and holds however wrong the constant becomes. A bump has to be typed
 * here, which is the same discipline the migration suite already asks for.
 */
export const CURRENT_STORAGE_VERSION = 8;

/**
 * Queue a seed for the next navigation: clear every `achievement-calendars*` key,
 * then write exactly the entries given. Call before `page.goto`/`page.reload`.
 *
 * Init scripts ACCUMULATE — there is no way to remove one — so a second call does not
 * replace the first, it runs after it. Correctness rests on every script clearing the
 * prefix before writing, which makes the last one added the one that wins. A seed helper
 * that skipped that clear would be silently overridden by an earlier call.
 */
export async function seed(page: Page, entries: Record<string, string>): Promise<void> {
  await page.addInitScript((seedEntries: Record<string, string>) => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('achievement-calendars')) localStorage.removeItem(key);
    }
    for (const [key, value] of Object.entries(seedEntries)) localStorage.setItem(key, value);
  }, entries);
}

/** Seed only the state key, from an object serialized as the app would store it. */
export async function seedState(page: Page, state: unknown): Promise<void> {
  await seed(page, { [STORAGE_KEY]: JSON.stringify(state) });
}

/** Read a key back verbatim. `null` when absent — the two are different outcomes. */
export async function readKey(page: Page, key: string): Promise<string | null> {
  return page.evaluate(k => localStorage.getItem(k), key);
}

/** Read the state key parsed. Throws when absent, so a missing key is never a silent `{}`. */
export async function readState(page: Page, key = STORAGE_KEY): Promise<any> {
  const raw = await readKey(page, key);
  if (raw === null) throw new Error(`${key} is absent`);
  return JSON.parse(raw);
}

/** Wait until the app has mounted and published its store. */
export async function waitForApp(page: Page): Promise<void> {
  await page.waitForFunction(() => window.__store !== undefined);
}

/** Open the app with whatever seed is queued, and wait for the store. */
export async function open(page: Page): Promise<void> {
  await page.goto('/');
  await waitForApp(page);
}

/**
 * Reload, re-running whatever seed is queued. Named for the user action, not the storage
 * effect: the queued init script clears and reseeds on this navigation as on any other,
 * so a case wanting "reload with storage left as the app left it" must re-queue a seed of
 * the string it just read back.
 */
export async function reopen(page: Page): Promise<void> {
  await page.reload();
  await waitForApp(page);
}

/** Drive the real file input with an in-memory fixture, as a user's file would arrive. */
export async function importFile(page: Page, name: string, contents: string): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles({
    name,
    mimeType: 'application/json',
    buffer: Buffer.from(contents, 'utf8'),
  });
}

/** Choose an item from the header's ☰ menu, by its role and accessible name. */
export async function chooseFromMenu(page: Page, name: string, role: 'menuitem' | 'menuitemradio' = 'menuitem'): Promise<void> {
  await page.locator('header').getByRole('button', { name: 'Menu' }).click();
  await page.getByRole(role, { name, exact: true }).click();
}

/** Choose Export all and return the downloaded file's text. */
export async function exportToText(page: Page): Promise<string> {
  const waitForDownload = page.waitForEvent('download');
  await chooseFromMenu(page, 'Export all calendars');
  const download = await waitForDownload;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

/** Narrow a calendar read off the page to the scoring kind, failing the test otherwise. */
export function asScoring(cal: Calendar): ScoringCalendar {
  if (cal.kind !== 'scoring') throw new Error(`expected a scoring calendar, got ${cal.kind}`);
  return cal;
}
