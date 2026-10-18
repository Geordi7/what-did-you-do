export interface Calendar {
  id: string;
  name: string;
  color: string;
  days: Record<string, number>;
  activityValue: number;
  /** ISO 8601 instant recording when this calendar was last changed. */
  updatedAt: string;
  deleted?: boolean;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export type ChartRange = '28d' | '26w';

export interface AppState {
  version: number;
  theme: ThemeMode;
  calendars: Calendar[];
  chartRange?: ChartRange;
}

/* ── import review ───────────────────────────────────────────────────────── */

/**
 * How an imported calendar is folded into a live one it collides with. The
 * per-action day and metadata semantics live in `specs/03-02-import-export.md`.
 */
export type MergeAction = 'replace' | 'merge-by-sum' | 'merge-prefer-import' | 'merge-prefer-live';

/**
 * What the user chose for one row of the import review modal: drop it, add it
 * as a new calendar, or merge it into the calendar it collides with.
 */
export type RowDisposition =
  | { kind: 'skip' }
  | { kind: 'append' }
  | { kind: 'merge'; action: MergeAction };

/**
 * One calendar in a previewed payload, with the two numbers the review modal
 * shows: its event total, and the live calendar it would collide with.
 */
export interface ImportRow {
  calendar: Calendar;
  events: number;
  collidesWithId: string | null;
}

/**
 * The structured report produced when a load fails to migrate or validate.
 * Carries no calendar names and no day counts: failing paths and the payload
 * size are what debugging needs, and the user's own data is in the snapshot.
 */
export interface Diagnostic {
  /** Version read from the payload; `null` when it could not be read. */
  storedVersion: number | null;
  /** `STORAGE_VERSION`. */
  targetVersion: number;
  phase: 'migrate' | 'validate';
  /** The step that threw, named as a version transition; `null` when validating. */
  failingStep: string | null;
  issues: Array<{ path: string; message: string }>;
  /** Byte length of the stored string. */
  payloadBytes: number;
}
