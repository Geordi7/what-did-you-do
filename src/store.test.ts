import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BACKUP_KEY, STORAGE_VERSION } from './migrations';
import type { Calendar, ChartRange, ImportRow, RowDisposition, ThemeMode } from './types';

/**
 * The store, against a `localStorage` fake with the clock fixed.
 *
 * `specs/05-01-automated-tier.md` is authoritative for what is covered here:
 * the load path's guards and failure behaviour (`specs/03-01-migrations.md`), the
 * preview/apply split (`specs/03-02-import-export.md`), and the surface,
 * persistence and cross-tab protocol (`specs/02-02-state-store.md`).
 *
 * `src/store.ts` is a module-level `createRoot` singleton whose load path runs once
 * at import, reading global `localStorage` and `new Date()` with no injection seam.
 * So every scenario installs the fake and fixes the clock *before* importing it, and
 * `vi.resetModules()` gets a fresh load against freshly seeded storage. That keeps
 * this tier DOM-free and needs no production change.
 */

/* ── keys, mirrored from the store ───────────────────────────────────────── */

const STORAGE_KEY = 'achievement-calendars';
const THEME_KEY = 'achievement-calendars-theme';
const EXPORT_KEY = 'achievement-calendars-last-export';

/** `specs/07-security-standard.md`'s import cap, mirrored: the store does not export it. */
const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

/* ── the fakes ───────────────────────────────────────────────────────────── */

/**
 * A `localStorage` stand-in that records every *attempted* write, so a test can
 * assert that a path wrote nothing at all, and that can be made to fail a write
 * the way a full quota does.
 */
class FakeStorage {
  private readonly map = new Map<string, string>();
  readonly writes: Array<{ key: string; value: string }> = [];
  /** When set, every `setItem` throws it — a full quota. */
  throwOnWrite: Error | null = null;
  rejectKey: string | null = null;

  constructor(seed: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(seed)) this.map.set(key, value);
  }

  get length(): number {
    return this.map.size;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  getItem(key: string): string | null {
    const value = this.map.get(key);
    return value === undefined ? null : value;
  }

  setItem(key: string, value: string): void {
    this.writes.push({ key, value: String(value) });
    if (this.throwOnWrite !== null) throw this.throwOnWrite;
    if (key === this.rejectKey) throw new Error("quota exceeded");
    this.map.set(key, String(value));
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }

  writesTo(key: string): Array<{ key: string; value: string }> {
    return this.writes.filter(write => write.key === key);
  }
}

type StorageHandler = (event: StorageEvent) => void;

type Globals = { localStorage?: unknown; window?: unknown };

function globals(): Globals {
  return globalThis as unknown as Globals;
}

function installStorage(storage: FakeStorage | null): void {
  if (storage === null) delete globals().localStorage;
  else globals().localStorage = storage;
}

/**
 * A `window` with nothing but the two listener methods the store uses, so the
 * `storage` handler can be captured and invoked directly. The tier stays DOM-free.
 */
function installWindow(): StorageHandler[] {
  const handlers: StorageHandler[] = [];
  globals().window = {
    addEventListener(type: string, fn: StorageHandler) {
      if (type === 'storage') handlers.push(fn);
    },
    removeEventListener(type: string, fn: StorageHandler) {
      const at = handlers.indexOf(fn);
      if (at >= 0) handlers.splice(at, 1);
    },
  };
  return handlers;
}

/* ── booting the singleton ───────────────────────────────────────────────── */

type Store = (typeof import('./store'))['store'];

interface Booted {
  store: Store;
  storage: FakeStorage;
  /** The `storage` listeners the store registered, in registration order. */
  handlers: StorageHandler[];
}

async function boot(
  seed: Record<string, string> = {},
  options: { storage?: boolean; prepare?: (storage: FakeStorage) => void } = {},
): Promise<Booted> {
  vi.resetModules();
  const storage = new FakeStorage(seed);
  options.prepare?.(storage);
  installStorage(options.storage === false ? null : storage);
  const handlers = installWindow();
  const mod = await import('./store');
  return { store: mod.store, storage, handlers };
}

function fire(handlers: StorageHandler[], key: string | null, newValue: string | null): void {
  for (const handler of handlers) handler({ key, newValue } as unknown as StorageEvent);
}

/* ── fixtures ────────────────────────────────────────────────────────────── */

/** The boot instant, and a later one, so a stamp is distinguishable from a seed. */
const BOOT_NOW = '2026-05-01T00:00:00.000Z';
const LATER = '2026-06-02T03:04:05.678Z';
const SEEDED_AT = '2026-01-01T00:00:00.000Z';

const SENTINEL_BACKUP = '{"sentinel":"the one backup a failing load exists for"}';

function calendar(over: Partial<Calendar> & { id: string }): Calendar {
  return {
    name: 'Runs',
    color: '#40c463',
    days: {},
    activityValue: 1,
    updatedAt: SEEDED_AT,
    ...over,
  };
}

/** Calendar `a` is live, `b` is trashed — enough to pin index and trash state. */
function seededCalendars(): Calendar[] {
  return [
    calendar({ id: 'a', name: 'Runs', days: { '2025-01-02': 3, '2025-01-01': 1 } }),
    calendar({ id: 'b', name: 'Retired', days: { '2025-02-01': 5 }, deleted: true }),
  ];
}

/**
 * A stored string that is deliberately *not* what the store would write: indented,
 * so "byte-for-byte intact" cannot pass by accident.
 */
function pretty(state: unknown): string {
  return JSON.stringify(state, null, 2);
}

function currentSeed(): string {
  return pretty({
    version: STORAGE_VERSION,
    theme: 'dark',
    chartRange: '26w',
    calendars: seededCalendars(),
  });
}

/**
 * The store's own canonical form, mirrored: day keys sorted, calendar keys in the
 * order it writes them. The cross-tab loop guard compares strings, so an incoming
 * value has to be canonical for "no re-write" to mean anything.
 */
function canonicalCalendar(cal: Calendar): Record<string, unknown> {
  const days: Record<string, number> = {};
  for (const key of Object.keys(cal.days).sort()) days[key] = cal.days[key];
  const out: Record<string, unknown> = {
    id: cal.id,
    name: cal.name,
    color: cal.color,
    days,
    activityValue: cal.activityValue,
    updatedAt: cal.updatedAt,
  };
  if (cal.deleted !== undefined) out.deleted = cal.deleted;
  return out;
}

function canonicalEnvelope(parts: {
  theme: ThemeMode;
  chartRange: ChartRange;
  calendars: Calendar[];
}): string {
  return JSON.stringify({
    version: STORAGE_VERSION,
    theme: parts.theme,
    chartRange: parts.chartRange,
    calendars: parts.calendars.map(canonicalCalendar),
  });
}

/** An import envelope, as `specs/03-02-import-export.md` defines it. */
function exportEnvelope(calendars: Array<Partial<Calendar> & { id: string }>): string {
  return JSON.stringify({
    version: STORAGE_VERSION,
    exportedAt: SEEDED_AT,
    calendars: calendars.map(calendar),
  });
}

function ids(cals: readonly Calendar[]): string[] {
  return cals.map(cal => cal.id);
}

function rowsOf(store: Store, payload: string): ImportRow[] {
  const result = store.previewImport(payload);
  if (!result.ok) throw new Error(`preview rejected the payload: ${result.reason}`);
  return result.rows;
}

function rowFor(rows: readonly ImportRow[], id: string): ImportRow {
  const row = rows.find(candidate => candidate.calendar.id === id);
  if (row === undefined) throw new Error(`no previewed row for ${id}`);
  return row;
}

function decide(row: ImportRow, disposition: RowDisposition) {
  return { row, disposition };
}

beforeEach(() => {
  // Only `Date` is faked: the module loader needs real timers to resolve a
  // dynamic import, and the store reads nothing else off the clock.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(BOOT_NOW));
});

afterEach(() => {
  vi.useRealTimers();
  installStorage(null);
  delete globals().window;
});

/* ── load ────────────────────────────────────────────────────────────────── */

describe('load', () => {
  it('starts empty and unblocked with nothing stored', async () => {
    const { store } = await boot();
    expect(store.calendars).toEqual([]);
    expect(store.blocked).toBe(false);
    expect(store.diagnostic).toBeNull();
    expect(store.chartRange).toBe('28d');
  });

  it('loads a payload already at the current version', async () => {
    const { store } = await boot({ [STORAGE_KEY]: currentSeed() });
    expect(store.blocked).toBe(false);
    expect(store.diagnostic).toBeNull();
    expect(ids(store.calendars)).toEqual(['a', 'b']);
    expect(ids(store.activeCalendars)).toEqual(['a']);
    expect(ids(store.deletedCalendars)).toEqual(['b']);
    expect(store.chartRange).toBe('26w');
    expect(store.theme).toBe('dark');
    expect(store.calendars[0].updatedAt).toBe(SEEDED_AT);
  });

  it('migrates an older payload, stamping updatedAt with the boot instant', async () => {
    const raw = pretty({
      version: 3,
      theme: 'light',
      calendars: [{ id: 'v3', name: 'Pushups', color: '#216e39', days: { '2025-03-01': 10 } }],
    });
    const { store } = await boot({ [STORAGE_KEY]: raw });
    expect(store.blocked).toBe(false);
    expect(ids(store.calendars)).toEqual(['v3']);
    expect(store.calendars[0].activityValue).toBe(1);
    expect(store.calendars[0].updatedAt).toBe(BOOT_NOW);
    expect(store.chartRange).toBe('28d');
    expect(store.theme).toBe('light');
  });

  it('migrates an unversioned payload', async () => {
    const raw = pretty({ calendars: [{ id: 'v0', name: 'Runs', days: { '2025-01-01': 2 } }] });
    const { store } = await boot({ [STORAGE_KEY]: raw });
    expect(store.blocked).toBe(false);
    expect(ids(store.calendars)).toEqual(['v0']);
    expect(store.calendars[0].updatedAt).toBe(BOOT_NOW);
    expect(store.calendars[0].color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('snapshots the raw pre-migration string when a step actually ran', async () => {
    const raw = pretty({
      version: 4,
      calendars: [{ id: 'v4', name: 'Runs', color: '#216e39', days: {}, activityValue: 2 }],
      chartRange: '26w',
    });
    const { storage } = await boot({ [STORAGE_KEY]: raw, [BACKUP_KEY]: SENTINEL_BACKUP });
    expect(storage.getItem(BACKUP_KEY)).toBe(raw);
  });

  it('writes no snapshot when the boot migrates nothing', async () => {
    const { storage } = await boot({
      [STORAGE_KEY]: currentSeed(),
      [BACKUP_KEY]: SENTINEL_BACKUP,
    });
    expect(storage.writesTo(BACKUP_KEY)).toEqual([]);
    expect(storage.getItem(BACKUP_KEY)).toBe(SENTINEL_BACKUP);
  });
});

/* ── the newer-version guard ─────────────────────────────────────────────── */

describe('a stored version newer than current', () => {
  const newerSeed = () =>
    pretty({ version: STORAGE_VERSION + 1, theme: 'dark', calendars: seededCalendars() });

  it('neither loads nor saves, and blocks with no diagnostic', async () => {
    const raw = newerSeed();
    const { store, storage } = await boot({ [STORAGE_KEY]: raw, [BACKUP_KEY]: SENTINEL_BACKUP });
    expect(store.blocked).toBe(true);
    expect(store.diagnostic).toBeNull();
    expect(store.calendars).toEqual([]);
    expect(storage.writes).toEqual([]);
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(storage.getItem(BACKUP_KEY)).toBe(SENTINEL_BACKUP);
  });

  it('still saves nothing after a mutation, because there is no save path', async () => {
    const raw = newerSeed();
    const { store, storage } = await boot({ [STORAGE_KEY]: raw });
    store.addCalendar('Added in memory');
    expect(ids(store.calendars)).toHaveLength(1);
    expect(storage.writesTo(STORAGE_KEY)).toEqual([]);
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });
});

/* ── failure: a defect in stored data ────────────────────────────────────── */

describe('a migration or validation failure', () => {
  /** Valid as a version-3 envelope to the walk's eye, rejected by the 3 -> 4 step. */
  const migrateFailureSeed = () =>
    pretty({
      version: 3,
      calendars: [{ id: 'bad', name: 'Runs', color: 'not-a-hex-color', days: {} }],
    });

  /** Current shape, but two calendars share an id — the model forbids it. */
  const validateFailureSeed = () =>
    pretty({
      version: STORAGE_VERSION,
      theme: 'dark',
      chartRange: '28d',
      calendars: [calendar({ id: 'dup', name: 'One' }), calendar({ id: 'dup', name: 'Two' })],
    });

  /**
   * Migrates cleanly from version 3 and only then fails validation. This is the
   * case the snapshot rule exists for: a step *did* run, so an eager snapshot
   * would have clobbered the last good backup with a payload that then failed.
   */
  const migratingThenInvalidSeed = () =>
    pretty({
      version: 3,
      calendars: [
        { id: 'dup', name: 'One', color: '#216e39', days: {} },
        { id: 'dup', name: 'Two', color: '#216e39', days: {} },
      ],
    });

  const unparseableSeed = () => '{"version": 5, "calendars": [';

  const cases: Array<[string, () => string, 'migrate' | 'validate', string | null, number | null]> =
    [
      ['a step that throws', migrateFailureSeed, 'migrate', '3 -> 4', 3],
      ['a validation failure', validateFailureSeed, 'validate', null, STORAGE_VERSION],
      ['a payload that migrates and then fails validation', migratingThenInvalidSeed, 'validate', null, 3],
      ['an unparseable string', unparseableSeed, 'migrate', null, null],
    ];

  for (const [label, seed, phase, failingStep, storedVersion] of cases) {
    describe(label, () => {
      it('blocks over empty state and reports a diagnostic', async () => {
        const { store } = await boot({ [STORAGE_KEY]: seed() });
        expect(store.blocked).toBe(true);
        expect(store.calendars).toEqual([]);
        expect(store.diagnostic).not.toBeNull();
        expect(store.diagnostic?.phase).toBe(phase);
        expect(store.diagnostic?.failingStep).toBe(failingStep);
        expect(store.diagnostic?.storedVersion).toBe(storedVersion);
        expect(store.diagnostic?.targetVersion).toBe(STORAGE_VERSION);
      });

      it('leaves the stored string byte-for-byte intact and writes no save', async () => {
        const raw = seed();
        const { storage } = await boot({ [STORAGE_KEY]: raw });
        expect(storage.getItem(STORAGE_KEY)).toBe(raw);
        expect(storage.writesTo(STORAGE_KEY)).toEqual([]);
      });

      it('leaves a pre-existing snapshot alone', async () => {
        const { storage } = await boot({
          [STORAGE_KEY]: seed(),
          [BACKUP_KEY]: SENTINEL_BACKUP,
        });
        expect(storage.writesTo(BACKUP_KEY)).toEqual([]);
        expect(storage.getItem(BACKUP_KEY)).toBe(SENTINEL_BACKUP);
      });

      it('writes nothing whatsoever', async () => {
        const { storage } = await boot({ [STORAGE_KEY]: seed() });
        expect(storage.writes).toEqual([]);
      });
    });
  }
});

/* ── storage unavailable or full ─────────────────────────────────────────── */

describe('storage trouble', () => {
  it('surfaces an error and stays usable when storage is unavailable', async () => {
    const { store } = await boot({}, { storage: false });
    expect(store.blocked).toBe(false);
    expect(store.storageError).toMatch(/unavailable/i);
    store.addCalendar('In memory');
    expect(store.calendars).toHaveLength(1);
    expect(store.calendars[0].name).toBe('In memory');
  });

  it('surfaces a full-storage error and stays usable when a write fails', async () => {
    const quota = new Error('the quota has been exceeded');
    quota.name = 'QuotaExceededError';
    const { store } = await boot(
      { [STORAGE_KEY]: currentSeed() },
      { prepare: storage => void (storage.throwOnWrite = quota) },
    );
    expect(store.blocked).toBe(false);
    expect(store.storageError).toMatch(/full/i);
    store.setCalendarName('a', 'Renamed anyway');
    expect(store.calendars[0].name).toBe('Renamed anyway');
    expect(store.storageError).toMatch(/full/i);
  });
});

/* ── previewImport ───────────────────────────────────────────────────────── */

describe('previewImport', () => {
  it('writes nothing', async () => {
    const { store, storage } = await boot({ [STORAGE_KEY]: currentSeed() });
    const before = storage.writes.length;
    const result = store.previewImport(exportEnvelope([{ id: 'fresh', name: 'Yoga' }]));
    expect(result.ok).toBe(true);
    expect(storage.writes.length).toBe(before);
    expect(ids(store.calendars)).toEqual(['a', 'b']);
  });

  it('rejects an oversized payload before parsing it', async () => {
    const { store, storage } = await boot({ [STORAGE_KEY]: currentSeed() });
    const before = storage.writes.length;
    // Over the cap and not JSON: if the size check ran after the parse, the
    // reason would be the unreadable-file one instead.
    const oversized = 'x'.repeat(MAX_IMPORT_BYTES + 1);
    const result = store.previewImport(oversized);
    expect(result).toEqual({ ok: false, reason: 'That file is too large to import.' });
    expect(storage.writes.length).toBe(before);
  });

  it('reports each row of the payload, with its event total and its collision', async () => {
    const { store } = await boot({ [STORAGE_KEY]: currentSeed() });
    const rows = rowsOf(
      store,
      exportEnvelope([
        { id: 'a', name: 'Runs (imported)', days: { '2025-01-01': 2, '2025-04-04': 7 } },
        { id: 'b', name: 'Retired (imported)', days: {} },
        { id: 'fresh', name: 'Yoga', days: { '2025-05-05': 4 } },
      ]),
    );
    expect(rows.map(row => row.calendar.id)).toEqual(['a', 'b', 'fresh']);
    expect(rows.map(row => row.events)).toEqual([9, 0, 4]);
    expect(rows.map(row => row.collidesWithId)).toEqual(['a', 'b', null]);
  });

  it('accepts a bare array of calendars as legacy data', async () => {
    const { store } = await boot({ [STORAGE_KEY]: currentSeed() });
    const payload = JSON.stringify([
      { id: 'legacy', name: 'Runs', color: '#216e39', days: { '2025-01-01': 1 } },
    ]);
    const rows = rowsOf(store, payload);
    expect(rows.map(row => row.calendar.id)).toEqual(['legacy']);
    expect(rows[0].calendar.updatedAt).toBe(BOOT_NOW);
    expect(rows[0].collidesWithId).toBeNull();
  });

  it('accepts a single calendar object as legacy data', async () => {
    const { store } = await boot({ [STORAGE_KEY]: currentSeed() });
    const payload = JSON.stringify({
      id: 'lone',
      name: 'Runs',
      color: '#216e39',
      days: { '2025-01-01': 3 },
    });
    const rows = rowsOf(store, payload);
    expect(rows.map(row => row.calendar.id)).toEqual(['lone']);
    expect(rows[0].events).toBe(3);
  });

  it('rejects a payload from a newer version', async () => {
    const { store } = await boot({ [STORAGE_KEY]: currentSeed() });
    const result = store.previewImport(
      JSON.stringify({ version: STORAGE_VERSION + 1, calendars: [] }),
    );
    expect(result).toEqual({
      ok: false,
      reason: 'That file was saved by a newer version of this app.',
    });
  });

  it('rejects an invalid payload without touching stored data', async () => {
    const raw = currentSeed();
    const { store, storage } = await boot({ [STORAGE_KEY]: raw });
    const writesBefore = storage.writes.length;
    const stored = storage.getItem(STORAGE_KEY);
    const result = store.previewImport(JSON.stringify({ version: STORAGE_VERSION, calendars: 7 }));
    expect(result.ok).toBe(false);
    expect(ids(store.calendars)).toEqual(['a', 'b']);
    expect(storage.writes.length).toBe(writesBefore);
    expect(storage.getItem(STORAGE_KEY)).toBe(stored);
  });
});

/* ── applyImport ─────────────────────────────────────────────────────────── */

describe('applyImport', () => {
  it('changes nothing at all when every row is skipped', async () => {
    const { store, storage } = await boot({ [STORAGE_KEY]: currentSeed() });
    const before = JSON.parse(JSON.stringify(store.calendars));
    const writesBefore = storage.writesTo(STORAGE_KEY).length;
    const rows = rowsOf(
      store,
      exportEnvelope([
        { id: 'a', name: 'Runs (imported)', days: { '2025-09-09': 9 } },
        { id: 'fresh', name: 'Yoga' },
      ]),
    );
    vi.setSystemTime(new Date(LATER));
    const imported = store.applyImport(rows.map(row => decide(row, { kind: 'skip' })));
    expect(imported).toBe(0);
    expect(JSON.parse(JSON.stringify(store.calendars))).toEqual(before);
    expect(storage.writesTo(STORAGE_KEY).length).toBe(writesBefore);
  });

  it('appends a non-colliding row at the end, undeleted whatever the source said', async () => {
    const { store } = await boot({ [STORAGE_KEY]: currentSeed() });
    const rows = rowsOf(
      store,
      exportEnvelope([
        { id: 'fresh', name: 'Yoga', days: { '2025-05-05': 4 }, deleted: true },
      ]),
    );
    expect(rows[0].calendar.deleted).toBe(true);
    const imported = store.applyImport([decide(rows[0], { kind: 'append' })]);
    expect(imported).toBe(1);
    expect(ids(store.calendars)).toEqual(['a', 'b', 'fresh']);
    const appended = store.calendars[2];
    expect(appended.deleted).toBeUndefined();
    expect(appended.days).toEqual({ '2025-05-05': 4 });
    expect(ids(store.deletedCalendars)).toEqual(['b']);
  });

  it('keeps the live id, index and trash state through a merge', async () => {
    const { store } = await boot({ [STORAGE_KEY]: currentSeed() });
    const rows = rowsOf(
      store,
      exportEnvelope([
        {
          id: 'b',
          name: 'Retired (imported)',
          color: '#216e39',
          activityValue: 9,
          days: { '2025-02-01': 2, '2025-03-03': 4 },
        },
      ]),
    );
    vi.setSystemTime(new Date(LATER));
    const imported = store.applyImport([
      decide(rows[0], { kind: 'merge', action: 'merge-by-sum' }),
    ]);
    expect(imported).toBe(1);
    expect(ids(store.calendars)).toEqual(['a', 'b']);
    const merged = store.calendars[1];
    expect(merged.id).toBe('b');
    expect(merged.deleted).toBe(true);
    // merge-by-sum: union of dates, a shared date summed, live metadata kept.
    expect(merged.days).toEqual({ '2025-02-01': 7, '2025-03-03': 4 });
    expect(merged.name).toBe('Retired');
    expect(merged.activityValue).toBe(1);
    expect(merged.updatedAt).toBe(LATER);
    // The other calendar is untouched, timestamp included.
    expect(store.calendars[0].updatedAt).toBe(SEEDED_AT);
  });

  it('commits every disposition as one write', async () => {
    const { store, storage } = await boot({ [STORAGE_KEY]: currentSeed() });
    const rows = rowsOf(
      store,
      exportEnvelope([
        { id: 'a', name: 'Runs (imported)', days: { '2025-01-01': 4 } },
        { id: 'b', name: 'Retired (imported)' },
        { id: 'fresh', name: 'Yoga', days: { '2025-05-05': 1 } },
      ]),
    );
    const writesBefore = storage.writesTo(STORAGE_KEY).length;
    const imported = store.applyImport([
      decide(rowFor(rows, 'a'), { kind: 'merge', action: 'replace' }),
      decide(rowFor(rows, 'b'), { kind: 'skip' }),
      decide(rowFor(rows, 'fresh'), { kind: 'append' }),
    ]);
    expect(imported).toBe(2);
    expect(storage.writesTo(STORAGE_KEY).length).toBe(writesBefore + 1);
    expect(ids(store.calendars)).toEqual(['a', 'b', 'fresh']);
    expect(store.calendars[0].days).toEqual({ '2025-01-01': 4 });
  });
});

/* ── mutator stamping ────────────────────────────────────────────────────── */

describe('mutators', () => {
  const stamping: Array<[string, (store: Store) => void]> = [
    ['setCalendarName', store => store.setCalendarName('a', 'Renamed')],
    ['setColor', store => store.setColor('a', '#216e39')],
    ['setActivityValue', store => store.setActivityValue('a', -2.5)],
    ['incrementDay', store => store.incrementDay('a', '2025-07-07')],
    ['zeroDay', store => store.zeroDay('a', '2025-01-02')],
    ['deleteCalendar', store => store.deleteCalendar('a')],
  ];

  for (const [label, mutate] of stamping) {
    it(`${label} stamps only its own calendar's updatedAt`, async () => {
      const { store } = await boot({ [STORAGE_KEY]: currentSeed() });
      vi.setSystemTime(new Date(LATER));
      mutate(store);
      expect(store.calendars[0].updatedAt).toBe(LATER);
      expect(store.calendars[1].updatedAt).toBe(SEEDED_AT);
    });
  }

  it("recoverCalendar stamps only the recovered calendar's updatedAt", async () => {
    const { store } = await boot({ [STORAGE_KEY]: currentSeed() });
    vi.setSystemTime(new Date(LATER));
    store.recoverCalendar('b');
    expect(store.calendars[1].deleted).toBe(false);
    expect(store.calendars[1].updatedAt).toBe(LATER);
    expect(store.calendars[0].updatedAt).toBe(SEEDED_AT);
  });

  it('zeroing an untouched day stamps nothing', async () => {
    const { store } = await boot({ [STORAGE_KEY]: currentSeed() });
    vi.setSystemTime(new Date(LATER));
    store.zeroDay('a', '2025-12-25');
    expect(store.calendars[0].updatedAt).toBe(SEEDED_AT);
    expect(store.calendars[1].updatedAt).toBe(SEEDED_AT);
  });

  it('reordering stamps nothing: it is not a change to a calendar', async () => {
    const { store } = await boot({ [STORAGE_KEY]: currentSeed() });
    store.addCalendar('Second active');
    const added = store.calendars[2].id;
    vi.setSystemTime(new Date(LATER));
    store.moveCalendar(added, -1);
    expect(ids(store.calendars)).toEqual([added, 'b', 'a']);
    expect(store.calendars[2].updatedAt).toBe(SEEDED_AT);
    expect(store.calendars[1].updatedAt).toBe(SEEDED_AT);
    expect(store.calendars[0].updatedAt).toBe(BOOT_NOW);
  });

  it('permanent delete removes the calendar and leaves the others stamped as they were', async () => {
    const { store } = await boot({ [STORAGE_KEY]: currentSeed() });
    vi.setSystemTime(new Date(LATER));
    store.permanentlyDeleteCalendar('b');
    expect(ids(store.calendars)).toEqual(['a']);
    expect(store.calendars[0].updatedAt).toBe(SEEDED_AT);
  });
});

/* ── cross-tab sync ──────────────────────────────────────────────────────── */

describe('cross-tab sync', () => {
  it('registers exactly one storage listener', async () => {
    const { handlers } = await boot({ [STORAGE_KEY]: currentSeed() });
    expect(handlers).toHaveLength(1);
  });

  it('converges on another tab\'s state without the write loop re-firing', async () => {
    const { store, storage, handlers } = await boot({ [STORAGE_KEY]: currentSeed() });
    const incoming = canonicalEnvelope({
      theme: store.theme,
      chartRange: '26w',
      calendars: [
        calendar({ id: 'a', name: 'Runs', days: { '2025-01-01': 1, '2025-01-02': 4 }, updatedAt: LATER }),
        calendar({ id: 'b', name: 'Retired', days: { '2025-02-01': 5 }, deleted: true }),
      ],
    });
    const writesBefore = storage.writesTo(STORAGE_KEY).length;
    fire(handlers, STORAGE_KEY, incoming);
    expect(ids(store.calendars)).toEqual(['a', 'b']);
    expect(store.calendars[0].days).toEqual({ '2025-01-01': 1, '2025-01-02': 4 });
    expect(store.calendars[0].updatedAt).toBe(LATER);
    expect(storage.writesTo(STORAGE_KEY).length).toBe(writesBefore);
  });

  it('reconciles rather than assigning, so an unaffected row keeps its identity', async () => {
    const { store, handlers } = await boot({ [STORAGE_KEY]: currentSeed() });
    const untouched = store.calendars[1];
    const incoming = canonicalEnvelope({
      theme: store.theme,
      chartRange: store.chartRange,
      calendars: [
        calendar({ id: 'a', name: 'Runs renamed elsewhere', days: { '2025-01-01': 1, '2025-01-02': 3 } }),
        calendar({ id: 'b', name: 'Retired', days: { '2025-02-01': 5 }, deleted: true }),
      ],
    });
    fire(handlers, STORAGE_KEY, incoming);
    expect(store.calendars[0].name).toBe('Runs renamed elsewhere');
    expect(store.calendars[1]).toBe(untouched);
  });

  it('ignores a cleared key and keeps memory state standing', async () => {
    const { store, handlers } = await boot({ [STORAGE_KEY]: currentSeed() });
    fire(handlers, STORAGE_KEY, null);
    fire(handlers, null, null);
    expect(ids(store.calendars)).toEqual(['a', 'b']);
  });

  it('ignores an unreadable value from another tab', async () => {
    const { store, handlers } = await boot({ [STORAGE_KEY]: currentSeed() });
    fire(handlers, STORAGE_KEY, '{"version": 5, "calendars":');
    expect(ids(store.calendars)).toEqual(['a', 'b']);
    expect(store.blocked).toBe(false);
  });

  it('takes a theme change from another tab without writing it back', async () => {
    const { store, storage, handlers } = await boot({
      [STORAGE_KEY]: currentSeed(),
      [THEME_KEY]: 'dark',
    });
    const writesBefore = storage.writesTo(THEME_KEY).length;
    fire(handlers, THEME_KEY, 'light');
    expect(store.theme).toBe('light');
    expect(storage.writesTo(THEME_KEY).length).toBe(writesBefore);
  });

  it('takes a last-export change from another tab', async () => {
    const { store, handlers } = await boot({ [STORAGE_KEY]: currentSeed() });
    fire(handlers, EXPORT_KEY, '1700000000000');
    expect(store.lastExport).toBe(1700000000000);
  });

  it('applies no state from another tab while the stored data is a defect', async () => {
    const raw = '{"version": 5, "calendars": [';
    const { store, storage, handlers } = await boot({ [STORAGE_KEY]: raw });
    fire(
      handlers,
      STORAGE_KEY,
      canonicalEnvelope({ theme: 'system', chartRange: '28d', calendars: seededCalendars() }),
    );
    expect(store.calendars).toEqual([]);
    expect(storage.writesTo(STORAGE_KEY)).toEqual([]);
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });
});

/* ── export, and the last-export stamp ───────────────────────────────────── */

describe('export', () => {
  it('covers every calendar, trashed ones included', async () => {
    const { store } = await boot({ [STORAGE_KEY]: currentSeed() });
    const parsed = JSON.parse(store.exportAll());
    expect(parsed.version).toBe(STORAGE_VERSION);
    expect(parsed.exportedAt).toBe(BOOT_NOW);
    expect(parsed.calendars.map((cal: Calendar) => cal.id)).toEqual(['a', 'b']);
  });

  it('exports one calendar by id, and nothing for an unknown one', async () => {
    const { store } = await boot({ [STORAGE_KEY]: currentSeed() });
    expect(JSON.parse(store.exportCalendar('a')).calendars).toHaveLength(1);
    expect(store.exportCalendar('nope')).toBe('');
  });

  it('records the last export timestamp', async () => {
    const { store, storage } = await boot({ [STORAGE_KEY]: currentSeed() });
    store.setLastExport();
    expect(store.lastExport).toBe(Date.parse(BOOT_NOW));
    expect(storage.getItem(EXPORT_KEY)).toBe(String(Date.parse(BOOT_NOW)));
  });
});

describe('newer-version guard precedes legacy wrapping', () => {
  it('refuses a newer-version payload that carries no calendars key', async () => {
    // `wrapLegacy` turns any object without `calendars` into a version-3 envelope. Read
    // in that order the marker is swallowed and data from the future takes the ordinary
    // migration path, so the guard must see the raw payload first.
    const seed = JSON.stringify({ version: 9, somethingNew: 1 });
    const { store, storage } = await boot({ [STORAGE_KEY]: seed });
    expect(store.blocked).toBe(true);
    expect(store.diagnostic).toBeNull();
    expect(storage.getItem(STORAGE_KEY)).toBe(seed);
    expect(storage.writes).toEqual([]);
  });

  it('still refuses it on the import path, with the newer-version reason', async () => {
    const { store } = await boot();
    const result = store.previewImport(JSON.stringify({ version: 9, somethingNew: 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/newer version/i);
  });

  it('leaves the genuine legacy shapes working', async () => {
    const { store } = await boot();
    const bare = store.previewImport(
      JSON.stringify([
        { id: 'l-a', name: 'Walks', color: '#40c463', days: { '2025-05-02': 4 }, activityValue: 1 },
      ]),
    );
    expect(bare.ok).toBe(true);
    const lone = store.previewImport(
      JSON.stringify({
        id: 'l-b', name: 'Naps', color: '#216e39', days: { '2025-05-03': 1 }, activityValue: 1,
      }),
    );
    expect(lone.ok).toBe(true);
  });
});


describe('selective persistence failures', () => {
  it('guards a throwing browser storage accessor', async () => {
    vi.resetModules();
    installWindow();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true, get() { throw new Error('storage denied'); },
    });
    let loaded: Store | undefined;
    let failure: unknown = null;
    try { loaded = (await import('./store')).store; } catch (error) { failure = error; }
    expect(failure).toBeNull();
    expect(loaded?.storageError).toMatch(/unavailable/);
    loaded?.addCalendar('Memory');
    expect(loaded?.calendars.length).toBe(1);
  });

  it('keeps a failed state save visible after successful preference writes', async () => {
    const { store } = await boot({}, { prepare: s => { s.rejectKey = STORAGE_KEY; } });
    store.addCalendar('Memory');
    store.setTheme('dark');
    store.setLastExport();
    expect(store.storageError).toMatch(/full/);
    expect(store.calendars.length).toBe(1);
  });

  it('preserves old data when its snapshot cannot be saved', async () => {
    const raw = JSON.stringify({ version: 4, calendars: [{ id: 'old', name: 'Old', color: '#40c463', days: {}, activityValue: 1 }] });
    const { store, storage } = await boot({ [STORAGE_KEY]: raw }, { prepare: s => { s.rejectKey = BACKUP_KEY; } });
    store.addCalendar('Memory');
    store.setLastExport();
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    expect(storage.writesTo(STORAGE_KEY)).toEqual([]);
    expect(store.storageError).toMatch(/full/);
    expect(store.calendars.length).toBe(2);
  });
});

it('protects a previously accepted impossible-date history', async () => {
  const raw = exportEnvelope([{ id: 'bad-date', days: { '2026-02-30': 4 } }]);
  const { store, storage } = await boot({ [STORAGE_KEY]: raw });
  expect(store.blocked).toBe(true);
  expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  expect(store.previewImport(raw).ok).toBe(false);
});
