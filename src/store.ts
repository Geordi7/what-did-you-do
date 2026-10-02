import { createEffect, createRoot, createSignal, onCleanup } from 'solid-js';
import { createStore, produce, reconcile } from 'solid-js/store';
import type {
  AppState,
  Calendar,
  ChartRange,
  Diagnostic,
  ImportRow,
  RowDisposition,
  ThemeMode,
} from './types';
import { BACKUP_KEY, MIGRATIONS, STORAGE_VERSION, type Migration } from './migrations';
import {
  DEFAULT_CHART_RANGE,
  DEFAULT_THEME,
  parseCurrentAppState,
  type CurrentAppState,
} from './schemas';
import { buildDiagnostic } from './diagnostic';
import { mergeCalendars } from './merge';
import { newId, randomColor, totalActivities } from './utils';

/**
 * The single owner of app state and of every mutation of it.
 *
 * `specs/02-02-state-store.md` is authoritative for the container, the
 * persistence keys, and the cross-tab protocol; `specs/03-01-migrations.md` for
 * the load path's guards and its failure behaviour; `specs/03-02-import-export.md`
 * for the envelope and the preview/apply split.
 *
 * Two failure paths live here and must not be confused:
 *
 * - **blocked** — stored data failed to migrate or validate, or was written by a
 *   newer version. That is a defect, so nothing is written, the stored string
 *   stays byte-intact, and the app runs empty in memory behind a blocking
 *   message.
 * - **storageError** — `localStorage` is unavailable or full. That is the
 *   environment's fault, so the app keeps running normally in memory behind an
 *   error banner.
 */

/* ── keys and caps ───────────────────────────────────────────────────────── */

const STORAGE_KEY = 'achievement-calendars';
const THEME_KEY = 'achievement-calendars-theme';
const EXPORT_KEY = 'achievement-calendars-last-export';

/** `specs/07-security-standard.md`: an oversized payload is rejected unparsed. */
const MAX_IMPORT_BYTES = 50 * 1024 * 1024;

/**
 * `specs/03-02-import-export.md` "Accepted input": a bare calendar array or a
 * lone calendar object is legacy data and is wrapped as version 3 before any
 * migration step sees it.
 */
const LEGACY_VERSION = 3;

/* ── storage access ──────────────────────────────────────────────────────── */

function storageAvailable(): boolean {
  return typeof localStorage !== 'undefined';
}

function storageMessage(error: unknown): string {
  const quota = error instanceof Error && /quota/i.test(`${error.name} ${error.message}`);
  return quota
    ? 'Storage is full, so changes are not being saved. This session is running in memory only.'
    : 'Storage is unavailable, so changes are not being saved. This session is running in memory only.';
}

/* ── state container ─────────────────────────────────────────────────────── */

/**
 * What the store holds. `theme` and the last-export timestamp are standalone
 * preferences rather than part of the state tree, so they are signals; both are
 * folded back into the persisted envelope on write.
 */
interface StoreState {
  version: number;
  chartRange: ChartRange;
  calendars: Calendar[];
}

function emptyState(): StoreState {
  return { version: STORAGE_VERSION, chartRange: DEFAULT_CHART_RANGE, calendars: [] };
}

function toStoreState(parsed: CurrentAppState): StoreState {
  return {
    version: STORAGE_VERSION,
    chartRange: parsed.chartRange,
    calendars: parsed.calendars.map(cal => ({ ...cal, days: { ...cal.days } })),
  };
}

/* ── payload interpretation (no writes) ──────────────────────────────────── */

type Interpretation =
  | { kind: 'ok'; state: CurrentAppState; storedVersion: number | null }
  | { kind: 'newer'; storedVersion: number }
  | {
      kind: 'failed';
      phase: 'migrate' | 'validate';
      failingStep: string | null;
      storedVersion: number | null;
      error: unknown;
    };

/** The `version` marker of a payload, or `null` when it carries no readable one. */
function readVersion(payload: unknown): number | null {
  if (typeof payload !== 'object' || payload === null) return null;
  if (!('version' in payload)) return null;
  const marker = payload.version;
  return typeof marker === 'number' ? marker : null;
}

/**
 * A marker above the current version. `Infinity` qualifies: it is reachable from
 * real input, since `JSON.parse('{"version":1e999}').version` is `Infinity`.
 */
function isNewer(marker: number): boolean {
  return !Number.isNaN(marker) && marker > STORAGE_VERSION;
}

/** Where the stepwise walk starts. An unreadable or nonsensical marker is version 0. */
function startVersion(marker: number | null): number {
  if (marker === null || !Number.isFinite(marker)) return 0;
  const truncated = Math.trunc(marker);
  return truncated < 0 ? 0 : truncated;
}

/**
 * Wrap a legacy shape in an envelope. A migration step parses a versioned
 * envelope, never a bare array or a lone calendar.
 */
function wrapLegacy(payload: unknown): unknown {
  if (Array.isArray(payload)) return { version: LEGACY_VERSION, calendars: payload };
  if (typeof payload === 'object' && payload !== null && !('calendars' in payload)) {
    return { version: LEGACY_VERSION, calendars: [payload] };
  }
  return payload;
}

type Probe =
  | { kind: 'parsed'; payload: unknown; storedVersion: number | null }
  | { kind: 'newer'; storedVersion: number }
  | { kind: 'unparseable'; error: unknown };

/**
 * Read a payload string far enough to know its version, and no further.
 *
 * The load path needs this much before it is allowed to write anything: the
 * newer-version guard must refuse *before* the pre-migration snapshot, so a
 * build older than the stored data writes nothing whatsoever.
 */
function probe(raw: string): Probe {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { kind: 'unparseable', error };
  }
  // Read the marker BEFORE wrapping. `wrapLegacy` turns any object without a
  // `calendars` key into a version-3 envelope, which would swallow a newer marker on
  // a payload like `{"version": 9, ...}` and send data from the future down the
  // ordinary migration path instead of tripping the guard.
  const declared = readVersion(parsed);
  if (declared !== null && isNewer(declared)) return { kind: 'newer', storedVersion: declared };
  const payload = wrapLegacy(parsed);
  const storedVersion = readVersion(payload);
  if (storedVersion !== null && isNewer(storedVersion)) return { kind: 'newer', storedVersion };
  return { kind: 'parsed', payload, storedVersion };
}

/**
 * Migrate a probed payload stepwise and validate the result. Pure: it touches no
 * storage and no state, which is what lets the load path, the cross-tab handler
 * and `previewImport` all share it.
 *
 * The walk is spelled out here rather than delegated to `migrate()` so a failing
 * step can be named in the diagnostic.
 */
function interpretParsed(payload: unknown, storedVersion: number | null, now: string): Interpretation {
  let current = payload;
  for (let from = startVersion(storedVersion); from < STORAGE_VERSION; from++) {
    const step: Migration | undefined = MIGRATIONS[from];
    if (step === undefined) continue;
    try {
      current = step(current, { now });
    } catch (error) {
      return {
        kind: 'failed',
        phase: 'migrate',
        failingStep: `${from} -> ${from + 1}`,
        storedVersion,
        error,
      };
    }
  }

  try {
    return { kind: 'ok', state: parseCurrentAppState(current), storedVersion };
  } catch (error) {
    return { kind: 'failed', phase: 'validate', failingStep: null, storedVersion, error };
  }
}

/** Probe and interpret in one go, for the paths that may write nothing anyway. */
function interpret(raw: string, now: string): Interpretation {
  const probed = probe(raw);
  if (probed.kind === 'newer') return probed;
  if (probed.kind === 'unparseable') {
    return {
      kind: 'failed',
      phase: 'migrate',
      failingStep: null,
      storedVersion: null,
      error: probed.error,
    };
  }
  return interpretParsed(probed.payload, probed.storedVersion, now);
}

/** Byte length of a string, the unit both the import cap and the diagnostic use. */
function byteLength(text: string): number {
  if (text.length > MAX_IMPORT_BYTES) return text.length; // already over any cap
  if (typeof TextEncoder === 'undefined') return text.length;
  return new TextEncoder().encode(text).length;
}

/* ── canonical serialization ─────────────────────────────────────────────── */

/**
 * Day keys are written in sorted order so that equal data always serializes to
 * an equal string. The cross-tab loop guard compares strings, and `reconcile`
 * leaves a day map's key order wherever it happened to be, so without a
 * canonical form two tabs holding identical data could disagree byte-wise and
 * write back and forth forever.
 */
function serializeDays(days: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of Object.keys(days).sort()) out[key] = days[key];
  return out;
}

/** A plain, canonically ordered copy of a calendar. Used for writes and exports. */
function serializeCalendar(cal: Calendar): Calendar {
  const out: Calendar = {
    id: cal.id,
    name: cal.name,
    color: cal.color,
    days: serializeDays(cal.days),
    activityValue: cal.activityValue,
    updatedAt: cal.updatedAt,
  };
  // Absent and `false` are different stored shapes; carry only the flag it had.
  if (cal.deleted !== undefined) out.deleted = cal.deleted;
  return out;
}

/* ── the store ───────────────────────────────────────────────────────────── */

export const store = createRoot(() => {
  const [storageError, setStorageError] = createSignal<string | null>(null);

  function readKey(key: string): string | null {
    if (!storageAvailable()) {
      setStorageError(storageMessage(undefined));
      return null;
    }
    try {
      return localStorage.getItem(key);
    } catch (error) {
      setStorageError(storageMessage(error));
      return null;
    }
  }

  function writeKey(key: string, value: string): boolean {
    if (!storageAvailable()) {
      setStorageError(storageMessage(undefined));
      return false;
    }
    try {
      localStorage.setItem(key, value);
      setStorageError(null);
      return true;
    } catch (error) {
      setStorageError(storageMessage(error));
      return false;
    }
  }

  /* ── load ──────────────────────────────────────────────────────────────── */

  const bootNow = new Date().toISOString();
  const rawState = readKey(STORAGE_KEY);

  let initial = emptyState();
  let initialTheme: ThemeMode | null = null;
  let initialBlocked = false;
  let initialDiagnostic: Diagnostic | null = null;

  if (rawState !== null && rawState !== '') {
    const payloadBytes = byteLength(rawState);
    const probed = probe(rawState);

    if (probed.kind === 'newer') {
      // Neither load nor save, and write nothing at all — not even the backup
      // snapshot — so data from a newer build cannot be touched by this one.
      initialBlocked = true;
    } else if (probed.kind === 'unparseable') {
      initialBlocked = true;
      initialDiagnostic = buildDiagnostic({
        storedVersion: null,
        targetVersion: STORAGE_VERSION,
        phase: 'migrate',
        failingStep: null,
        error: probed.error,
        payloadBytes,
      });
    } else {
      const migrating = startVersion(probed.storedVersion) < STORAGE_VERSION;
      const result = interpretParsed(probed.payload, probed.storedVersion, bootNow);
      if (result.kind === 'ok') {
        // The snapshot holds the raw PRE-migration string, but it is only written once the
        // walk has succeeded, and only when a step actually ran. Writing it eagerly would
        // clobber the last good backup with a payload that then failed to migrate — the
        // one moment the backup exists for. A boot that migrates nothing leaves it alone.
        if (migrating) writeKey(BACKUP_KEY, rawState);
        initial = toStoreState(result.state);
        initialTheme = result.state.theme;
      } else if (result.kind === 'failed') {
        initialBlocked = true;
        initialDiagnostic = buildDiagnostic({
          storedVersion: result.storedVersion,
          targetVersion: STORAGE_VERSION,
          phase: result.phase,
          failingStep: result.failingStep,
          error: result.error,
          payloadBytes,
        });
      } else {
        initialBlocked = true;
      }
    }
  }

  const [state, setState] = createStore<StoreState>(initial);

  // Decided once, at load: nothing the running app does can block or unblock it,
  // so these are plain values rather than signals.
  const blocked = initialBlocked;
  const diagnostic = initialDiagnostic;

  const rawTheme = readKey(THEME_KEY);
  const [theme, setThemeSignal] = createSignal<ThemeMode>(
    isThemeMode(rawTheme) ? rawTheme : (initialTheme ?? DEFAULT_THEME),
  );

  const [lastExport, setLastExportSignal] = createSignal<number | null>(
    parseTimestamp(readKey(EXPORT_KEY)),
  );

  const [highlightedKey, setHighlightedKey] = createSignal<string | null>(null);

  /* ── persistence ───────────────────────────────────────────────────────── */

  /** The exact string last written to, or read from, `STORAGE_KEY`: the loop guard. */
  let lastWritten: string | null = null;
  let lastWrittenTheme: string | null = rawTheme;

  /** The persisted envelope, canonical and complete. Reads every tracked path. */
  function serialize(): string {
    const envelope: AppState = {
      version: STORAGE_VERSION,
      theme: theme(),
      chartRange: state.chartRange,
      calendars: state.calendars.map(serializeCalendar),
    };
    return JSON.stringify(envelope);
  }

  // When blocked there is no save path at all: the stored string must stay
  // byte-intact, so the effects that would write it are never created.
  if (!blocked) {
    createEffect(() => {
      const payload = serialize();
      if (payload === lastWritten) return;
      if (writeKey(STORAGE_KEY, payload)) lastWritten = payload;
    });

    createEffect(() => {
      const mode = theme();
      if (mode === lastWrittenTheme) return;
      if (writeKey(THEME_KEY, mode)) lastWrittenTheme = mode;
    });
  }

  /* ── cross-tab sync ────────────────────────────────────────────────────── */

  // Fires only in other tabs, never in the writer; the loop guard exists for the
  // write this handler's own reconcile provokes, not for an echo of our write.
  function onStorageEvent(event: StorageEvent) {
    // A null key is `localStorage.clear()`, a null value a removed key. Either
    // way another tab cleared storage: memory state stands.
    if (event.key === null || event.newValue === null) return;

    if (event.key === THEME_KEY) {
      if (isThemeMode(event.newValue)) {
        lastWrittenTheme = event.newValue;
        setThemeSignal(event.newValue);
      }
      return;
    }

    if (event.key === EXPORT_KEY) {
      setLastExportSignal(parseTimestamp(event.newValue));
      return;
    }

    if (event.key !== STORAGE_KEY) return;
    if (blocked) return; // no load path either, while the stored data is a defect

    const result = interpret(event.newValue, new Date().toISOString());
    if (result.kind !== 'ok') return; // another tab wrote something unreadable
    lastWritten = event.newValue;
    // Reconciled, never assigned over: only the paths that differ change, so
    // untouched rows keep their identity and in-flight input edits survive.
    setState(reconcile(toStoreState(result.state), { key: 'id', merge: false }));
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorageEvent);
    onCleanup(() => window.removeEventListener('storage', onStorageEvent));
  }

  /* ── mutation helpers ──────────────────────────────────────────────────── */

  /**
   * Mutate one calendar in place and stamp its own `updatedAt`. A change to one
   * calendar leaves every other calendar's timestamp alone.
   */
  function editCalendar(id: string, edit: (cal: Calendar) => void) {
    const now = new Date().toISOString();
    setState(
      produce(draft => {
        const cal = draft.calendars.find(candidate => candidate.id === id);
        if (cal === undefined) return;
        edit(cal);
        cal.updatedAt = now;
      }),
    );
  }

  function envelope(calendars: Calendar[]): string {
    return JSON.stringify({
      version: STORAGE_VERSION,
      exportedAt: new Date().toISOString(),
      calendars: calendars.map(serializeCalendar),
    });
  }

  return {
    get state(): AppState {
      return state;
    },
    get theme(): ThemeMode {
      return theme();
    },
    get chartRange(): ChartRange {
      return state.chartRange;
    },
    get calendars(): Calendar[] {
      return state.calendars;
    },
    get activeCalendars(): Calendar[] {
      return state.calendars.filter(cal => !cal.deleted);
    },
    get deletedCalendars(): Calendar[] {
      return state.calendars.filter(cal => cal.deleted);
    },
    get highlightedKey(): string | null {
      return highlightedKey();
    },
    get lastExport(): number | null {
      return lastExport();
    },
    get storageError(): string | null {
      return storageError();
    },
    get blocked(): boolean {
      return blocked;
    },
    get diagnostic(): Diagnostic | null {
      return diagnostic;
    },

    setTheme(mode: ThemeMode) {
      setThemeSignal(mode);
    },

    setChartRange(range: ChartRange) {
      setState('chartRange', range);
    },

    setHighlightedKey(key: string | null) {
      setHighlightedKey(key);
    },

    addCalendar(name: string) {
      const cal: Calendar = {
        id: newId(),
        name,
        color: randomColor(),
        days: {},
        activityValue: 1.0,
        updatedAt: new Date().toISOString(),
      };
      setState(
        produce(draft => {
          draft.calendars.push(cal);
        }),
      );
    },

    deleteCalendar(id: string) {
      // Stays in the array at its index, so recovery returns it to its position.
      editCalendar(id, cal => {
        cal.deleted = true;
      });
    },

    recoverCalendar(id: string) {
      editCalendar(id, cal => {
        cal.deleted = false;
      });
    },

    permanentlyDeleteCalendar(id: string) {
      setState('calendars', cals => cals.filter(cal => cal.id !== id));
    },

    /**
     * Swap a calendar with its neighbour among the *active* calendars, so a
     * trashed calendar sitting between two active ones is stepped over rather
     * than swapped with. Reordering is not a change to a calendar, so no
     * `updatedAt` is stamped.
     */
    moveCalendar(id: string, direction: -1 | 1) {
      setState(
        produce(draft => {
          const activeIds = draft.calendars.filter(cal => !cal.deleted).map(cal => cal.id);
          const activeIdx = activeIds.indexOf(id);
          if (activeIdx < 0) return;
          const targetActiveIdx = activeIdx + direction;
          if (targetActiveIdx < 0 || targetActiveIdx >= activeIds.length) return;
          const from = draft.calendars.findIndex(cal => cal.id === id);
          const to = draft.calendars.findIndex(cal => cal.id === activeIds[targetActiveIdx]);
          if (from < 0 || to < 0) return;
          const moved = draft.calendars[from];
          draft.calendars[from] = draft.calendars[to];
          draft.calendars[to] = moved;
        }),
      );
    },

    setColor(id: string, color: string) {
      editCalendar(id, cal => {
        cal.color = color;
      });
    },

    setActivityValue(id: string, value: number) {
      editCalendar(id, cal => {
        cal.activityValue = value;
      });
    },

    setCalendarName(id: string, name: string) {
      editCalendar(id, cal => {
        cal.name = name;
      });
    },

    incrementDay(calId: string, dateKey: string) {
      editCalendar(calId, cal => {
        cal.days[dateKey] = (cal.days[dateKey] ?? 0) + 1;
      });
    },

    /** Resetting a day deletes its key rather than storing `0`. */
    zeroDay(calId: string, dateKey: string) {
      const now = new Date().toISOString();
      setState(
        produce(draft => {
          const cal = draft.calendars.find(candidate => candidate.id === calId);
          if (cal === undefined) return;
          // An absent key already reads as zero, so zeroing it changes nothing
          // and must not advance the calendar's last-update reading.
          if (!Object.prototype.hasOwnProperty.call(cal.days, dateKey)) return;
          delete cal.days[dateKey];
          cal.updatedAt = now;
        }),
      );
    },

    /* ── export ──────────────────────────────────────────────────────────── */

    /** The plain-JSON envelope for one calendar; `''` when the id is unknown. */
    exportCalendar(id: string): string {
      const cal = state.calendars.find(candidate => candidate.id === id);
      if (cal === undefined) return '';
      return envelope([cal]);
    },

    /** Every calendar, trashed ones included — a backup is complete. */
    exportAll(): string {
      return envelope(state.calendars);
    },

    setLastExport() {
      const stamp = Date.now();
      writeKey(EXPORT_KEY, stamp.toString());
      setLastExportSignal(stamp);
    },

    /* ── import ──────────────────────────────────────────────────────────── */

    /**
     * Size-check, parse, migrate and validate a payload, and describe every
     * calendar in it. Writes nothing: the review modal must show the rows before
     * anything is stored, and a payload that fails here has touched no state.
     */
    previewImport(text: string): { ok: true; rows: ImportRow[] } | { ok: false; reason: string } {
      if (byteLength(text) > MAX_IMPORT_BYTES) {
        return { ok: false, reason: 'That file is too large to import.' };
      }
      const result = interpret(text, new Date().toISOString());
      if (result.kind === 'newer') {
        return { ok: false, reason: 'That file was saved by a newer version of this app.' };
      }
      if (result.kind === 'failed') {
        return {
          ok: false,
          reason:
            result.phase === 'migrate'
              ? 'That file could not be read as calendar data.'
              : 'That file is not valid calendar data.',
        };
      }
      const liveIds = new Set(state.calendars.map(cal => cal.id));
      const rows: ImportRow[] = result.state.calendars.map(cal => ({
        calendar: cal,
        events: totalActivities(cal.days),
        collidesWithId: liveIds.has(cal.id) ? cal.id : null,
      }));
      return { ok: true, rows };
    },

    /**
     * Commit every disposition as one write and report how many calendars were
     * imported. A skipped row changes nothing at all: a skipped colliding row
     * leaves the live calendar's days, metadata, trash flag, index and
     * `updatedAt` exactly as they were.
     */
    applyImport(decided: Array<{ row: ImportRow; disposition: RowDisposition }>): number {
      const now = new Date().toISOString();
      let imported = 0;
      setState(
        produce(draft => {
          const seen = new Set(draft.calendars.map(cal => cal.id));
          for (const { row, disposition } of decided) {
            if (disposition.kind === 'skip') continue;

            if (disposition.kind === 'merge') {
              const idx = draft.calendars.findIndex(cal => cal.id === row.calendar.id);
              if (idx < 0) continue;
              draft.calendars[idx] = mergeCalendars(
                draft.calendars[idx],
                row.calendar,
                disposition.action,
                now,
              );
              imported++;
              continue;
            }

            // Append: at the end of the array, undeleted, whatever the source
            // said. An id already present would break the uniqueness the model
            // requires, so such a row is left out rather than corrupting state.
            if (seen.has(row.calendar.id)) continue;
            const appended: Calendar = {
              id: row.calendar.id,
              name: row.calendar.name,
              color: row.calendar.color,
              days: { ...row.calendar.days },
              activityValue: row.calendar.activityValue,
              updatedAt: row.calendar.updatedAt,
            };
            draft.calendars.push(appended);
            seen.add(appended.id);
            imported++;
          }
        }),
      );
      return imported;
    },
  };
});

/* ── small shared guards ─────────────────────────────────────────────────── */

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

function parseTimestamp(raw: string | null): number | null {
  if (raw === null) return null;
  const stamp = Number.parseInt(raw, 10);
  return Number.isFinite(stamp) ? stamp : null;
}
