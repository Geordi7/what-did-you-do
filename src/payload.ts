import type { Calendar, Todo } from './types';
import { STORAGE_VERSION, runMigrations } from './migrations';
import { parseCurrentAppState, type CurrentAppState } from './schemas';
import { MAX_IMPORT_BYTES } from './persistence-contract';

const LEGACY_VERSION = 3;

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
export function startVersion(marker: number | null): number {
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
export function probe(raw: string): Probe {
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
 * The shared runner reports the failing step for diagnostics.
 */
export function interpretParsed(payload: unknown, storedVersion: number | null, now: string): Interpretation {
  const result = runMigrations(payload, startVersion(storedVersion), { now });
  if (!result.ok) {
    return { kind: 'failed', phase: 'migrate', failingStep: result.failingStep, storedVersion, error: result.error };
  }
  const current = result.state;

  try {
    return { kind: 'ok', state: parseCurrentAppState(current), storedVersion };
  } catch (error) {
    return { kind: 'failed', phase: 'validate', failingStep: null, storedVersion, error };
  }
}

/** Probe and interpret in one go, for the paths that may write nothing anyway. */
export function interpret(raw: string, now: string): Interpretation {
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
export function byteLength(text: string): number {
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

/** A plain todo with its fields, and its Nudges', in one fixed order. */
function serializeTodo(todo: Todo): Todo {
  const out: Todo = { id: todo.id, title: todo.title, bounty: todo.bounty, created: todo.created, children: [] };
  if (todo.due !== undefined) out.due = todo.due;
  if (todo.done !== undefined) out.done = todo.done;
  if (todo.cancelled !== undefined) out.cancelled = todo.cancelled;
  out.children = todo.children.map(serializeTodo);
  return out;
}

/** A plain, canonically ordered copy of a calendar. Used for writes and exports. */
export function serializeCalendar(cal: Calendar): Calendar {
  const out: Calendar = cal.kind === 'scoring'
    ? {
      kind: 'scoring',
      id: cal.id,
      name: cal.name,
      color: cal.color,
      days: serializeDays(cal.days),
      activityValue: cal.activityValue,
      updatedAt: cal.updatedAt,
    }
    : {
      kind: 'gsd',
      id: cal.id,
      name: cal.name,
      color: cal.color,
      defaultBounty: cal.defaultBounty,
      todos: cal.todos.map(serializeTodo),
      updatedAt: cal.updatedAt,
    };
  // Absent and `false` are different stored shapes; carry only the flag it had.
  if (cal.deleted !== undefined) out.deleted = cal.deleted;
  return out;
}

