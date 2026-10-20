import * as v from '@badrap/valita';
import type { AppState, Calendar } from './types';

/**
 * One schema per storage version, plus the current-version parse.
 *
 * The version log lives in `specs/03-01-migrations.md`; every row there has a
 * schema here. Each `03-data-model.md` constraint is expressed once, as a
 * validator below, so nothing hand-rolls coercion and nothing casts.
 *
 * Unknown keys are stripped rather than rejected: stored and imported states
 * may carry fields that a later version dropped, and dropping them is exactly
 * what a migration to that version did.
 */
const STRIP: v.ParseOptions = { mode: 'strip' };

/**
 * Defaults named once, so a migration step that introduces a field and the
 * current-version parse that backfills it cannot disagree.
 */
export const DEFAULT_THEME = 'system';
export const DEFAULT_ACTIVITY_VALUE = 1.0;
export const DEFAULT_CHART_RANGE = '28d';
export const DEFAULT_CALENDAR_SORT = { by: 'custom', dir: 'desc' } as const;
export const DEFAULT_CALENDAR_FILTER = 'all';
export const DEFAULT_BOUNTY = 1;

/** `YYYY-MM-DD`, the only shape a `days` key ever takes. */
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function isCalendarDate(value: string): boolean {
  if (!DATE_KEY.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const probe = new Date(0);
  probe.setUTCFullYear(year, month - 1, day);
  return probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
}

/** `#rrggbb`; `parseHex` produces NaN channels for anything else. */
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/**
 * An ISO 8601 instant: a calendar date, a time, and a zone. An offset is
 * accepted as well as `Z`, because an imported file may not come from here.
 */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * True for a parseable ISO 8601 instant.
 *
 * Three checks, because no one of them is enough: the regex fixes the grammar
 * (`Date.parse` alone also accepts non-ISO strings the platform happens to
 * understand), `Date.parse` rejects out-of-range times such as `T25:00:00Z`,
 * and the round-trip rejects a calendar date that rolls over — `Date.parse`
 * reads `2025-02-30T00:00:00Z` as 2 March.
 *
 * Shared with the 4 -> 5 migration step, which keeps an `updatedAt` the input
 * already carried only when it is parseable.
 */
export function isIsoInstant(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_INSTANT.test(value)) return false;
  if (!Number.isFinite(Date.parse(value))) return false;
  return isCalendarDate(value.slice(0, 10));
}

const calendarId = v.string().assert(s => s.length > 0, 'expected a non-empty id');

const calendarName = v.string();

const hexColor = v.string().assert(s => HEX_COLOR.test(s), 'expected a #rrggbb color');

/** Counts are finite integers >= 0. `Number.isInteger` rejects NaN and Infinity. */
const dayCount = v
  .number()
  .assert(n => Number.isInteger(n) && n >= 0, 'expected an integer count >= 0');

const days = v
  .record(dayCount)
  .assert(d => Object.keys(d).every(isCalendarDate), 'expected real YYYY-MM-DD calendar dates');

/** A finite float of any sign: negative weights are intended. */
const activityValue = v.number().assert(Number.isFinite, 'expected a finite activity value');

const themeMode = v.union(v.literal('light'), v.literal('dark'), v.literal('system'));

const chartRange = v.union(v.literal('28d'), v.literal('26w'));

const calendarSort = v.object({
  by: v.union(v.literal('custom'), v.literal('activities'), v.literal('score'), v.literal('recent')),
  dir: v.union(v.literal('desc'), v.literal('asc')),
});

const deleted = v.boolean();

const isoInstant = v.string().assert(isIsoInstant, 'expected an ISO 8601 instant');

/**
 * Accepts any parseable ISO 8601 instant, then canonicalises to the single form
 * `03-data-model.md` pins: `YYYY-MM-DDTHH:mm:ss.sssZ`, UTC. The grammar stays lenient
 * because an imported file need not come from here, but storage only ever holds the
 * canonical form, so two equal instants are never two different strings.
 */
const canonicalIsoInstant = isoInstant.map(value => new Date(value).toISOString());

/** Markers a version-0 payload must never carry; see `appStateV0Schema`. */
const KNOWN_LATER_VERSIONS = new Set([1, 2, 3, 4, 5, 6, 7, 8]);

/* ── version 0: unversioned ──────────────────────────────────────────────── */

/**
 * `{ id, name, days, deleted? }`. `color` is optional rather than absent so a
 * state written by a build that already had colors keeps them through the
 * 0 -> 1 step instead of being recoloured.
 */
export const calendarV0Schema = v.object({
  id: calendarId,
  name: calendarName,
  color: hexColor.optional(),
  days,
  deleted: deleted.optional(),
});

/** No `theme` yet; `version` is missing or an explicit `0`. */
export const appStateV0Schema = v.object({
  // Not `literal(0)`. The walk has already decided this payload enters at version 0, and a
  // marker it could not make sense of (`-3`, `"x"`, NaN) is defined to mean unversioned — so
  // re-judging it here would block the app instead of migrating, as the entry rule promises.
  // A marker naming a REAL later version is still rejected: that would mean the walk is wrong,
  // and silently migrating a version-3 payload from 0 would corrupt it.
  version: v
    .unknown()
    .optional()
    .assert(
      marker => !KNOWN_LATER_VERSIONS.has(marker as number),
      'expected an absent, zero, or unrecognised version marker',
    ),
  calendars: v.array(calendarV0Schema),
});

/* ── versions 1-2 ────────────────────────────────────────────────────────── */

/**
 * `color` added. `activityValue` is optional for the same reason `color` is
 * optional at version 0.
 */
export const calendarV1V2Schema = v.object({
  id: calendarId,
  name: calendarName,
  color: hexColor,
  days,
  activityValue: activityValue.optional(),
  deleted: deleted.optional(),
});

/**
 * `theme` added to the state. Versions 1 and 2 cannot be told apart from
 * stored data, so one schema covers both and accepts either marker; `theme`
 * stays optional because a version-1 state may predate it.
 */
export const appStateV1V2Schema = v.object({
  version: v.union(v.literal(1), v.literal(2)),
  theme: themeMode.optional(),
  calendars: v.array(calendarV1V2Schema),
});

/* ── version 3 ───────────────────────────────────────────────────────────── */

/** `activityValue` required, defaulting to `1.0` when a source omitted it. */
export const calendarV3Schema = calendarV1V2Schema.extend({
  activityValue: activityValue.optional(() => DEFAULT_ACTIVITY_VALUE),
});

export const appStateV3Schema = v.object({
  version: v.literal(3),
  theme: themeMode.optional(),
  calendars: v.array(calendarV3Schema),
});

/* ── version 4 ───────────────────────────────────────────────────────────── */

/**
 * Version 4 adds `chartRange` to the state, so the calendar shape is version
 * 3's — except that `updatedAt` is carried through as `unknown` rather than
 * stripped. Nothing this app wrote before version 5 has one, but a hand-edited
 * or third-party file can, and the 4 -> 5 step keeps it when it parses. Typing
 * it here would reject a file whose `updatedAt` is garbage instead of letting
 * that step restamp it.
 */
export const calendarV4Schema = calendarV3Schema.extend({
  updatedAt: v.unknown().optional(),
});

export const appStateV4Schema = v.object({
  version: v.literal(4),
  theme: themeMode.optional(),
  calendars: v.array(calendarV4Schema),
  chartRange: chartRange.optional(() => DEFAULT_CHART_RANGE),
});

/* ── version 5 ───────────────────────────────────────────────────────────── */

/** `updatedAt` required, and required to be a parseable ISO 8601 instant. */
export const calendarV5Schema = calendarV4Schema.extend({
  updatedAt: canonicalIsoInstant,
});

export const appStateV5Schema = v.object({
  version: v.literal(5),
  theme: themeMode.optional(),
  calendars: v.array(calendarV5Schema),
  chartRange: chartRange.optional(() => DEFAULT_CHART_RANGE),
});

/* ── version 6 ───────────────────────────────────────────────────────────── */

/** Version 6 adds `calendarSort` to the state; the calendar shape is version 5's. */
export const calendarV6Schema = calendarV5Schema;

export const appStateV6Schema = v.object({
  version: v.literal(6),
  theme: themeMode.optional(),
  calendars: v.array(calendarV6Schema),
  chartRange: chartRange.optional(() => DEFAULT_CHART_RANGE),
  calendarSort: calendarSort.optional(() => ({ ...DEFAULT_CALENDAR_SORT })),
});

/* ── version 7 ───────────────────────────────────────────────────────────── */

const calendarFilter = v.union(v.literal('all'), v.literal('scoring'), v.literal('gsd'));

/** Bounties are finite and never negative: points are never negative. */
const bounty = v.number().assert(n => Number.isFinite(n) && n >= 0, 'expected a finite bounty >= 0');

const dayKey = v.string().assert(isCalendarDate, 'expected a real YYYY-MM-DD calendar date');

type TodoV7Shape = {
  id: string;
  title: string;
  bounty: number;
  due?: string;
  created: string;
  done?: string;
  children: TodoV7Shape[];
};

/** One todo and, recursively, its Nudges, as version 7 stored them. */
const todoV7Schema: v.Type<TodoV7Shape> = v.lazy(() =>
  v
    .object({
      id: calendarId,
      title: v.string(),
      bounty,
      due: dayKey.optional(),
      created: dayKey,
      done: dayKey.optional(),
      children: v.array(todoV7Schema),
    })
    .assert(todo => todo.done === undefined || todo.done >= todo.created, 'expected done on or after created'),
);

function todoIds(todos: readonly TodoV7Shape[]): string[] {
  return todos.flatMap(todo => [todo.id, ...todoIds(todo.children)]);
}

const uniqueTodoIds = (cal: { todos: readonly TodoV7Shape[] }) => {
  const ids = todoIds(cal.todos);
  return new Set(ids).size === ids.length;
};

/** Version 7 marks each calendar with its kind; existing calendars are scoring calendars. */
export const scoringCalendarV7Schema = calendarV6Schema.extend({ kind: v.literal('scoring') });

const gsdCalendarFields = {
  kind: v.literal('gsd'),
  id: calendarId,
  name: calendarName,
  color: hexColor,
  defaultBounty: bounty.optional(() => DEFAULT_BOUNTY),
  updatedAt: canonicalIsoInstant,
  deleted: deleted.optional(),
};

export const gsdCalendarV7Schema = v
  .object({ ...gsdCalendarFields, todos: v.array(todoV7Schema) })
  .assert(uniqueTodoIds, 'expected todo ids to be unique within a calendar');

export const calendarV7Schema = v.union(scoringCalendarV7Schema, gsdCalendarV7Schema);

export const appStateV7Schema = v.object({
  version: v.literal(7),
  theme: themeMode.optional(),
  calendars: v.array(calendarV7Schema),
  chartRange: chartRange.optional(() => DEFAULT_CHART_RANGE),
  calendarSort: calendarSort.optional(() => ({ ...DEFAULT_CALENDAR_SORT })),
  calendarFilter: calendarFilter.optional(() => DEFAULT_CALENDAR_FILTER),
});

/* ── version 8 (current) ─────────────────────────────────────────────────── */

type TodoShape = TodoV7Shape & { cancelled?: string; children: TodoShape[] };

/** Version 8 adds a todo's optional cancelled day, on or after its creation. */
const todoSchema: v.Type<TodoShape> = v.lazy(() =>
  v
    .object({
      id: calendarId,
      title: v.string(),
      bounty,
      due: dayKey.optional(),
      created: dayKey,
      done: dayKey.optional(),
      cancelled: dayKey.optional(),
      children: v.array(todoSchema),
    })
    .assert(todo => todo.done === undefined || todo.done >= todo.created, 'expected done on or after created')
    .assert(todo => todo.cancelled === undefined || todo.cancelled >= todo.created, 'expected cancelled on or after created'),
);

export const gsdCalendarV8Schema = v
  .object({ ...gsdCalendarFields, todos: v.array(todoSchema) })
  .assert(uniqueTodoIds, 'expected todo ids to be unique within a calendar');

export const calendarV8Schema = v.union(scoringCalendarV7Schema, gsdCalendarV8Schema);

/**
 * The current version. This is the only schema that supplies state-level
 * defaults, so parsing with it is what "normalize" means.
 *
 * The id assert lives here rather than on the array: `03-data-model.md` requires
 * ids unique across the array, so a duplicate is a defect and takes the load
 * path's failure route.
 */
export const appStateV8Schema = v
  .object({
    version: v.literal(8).optional(() => 8),
    theme: themeMode.optional(() => DEFAULT_THEME),
    calendars: v.array(calendarV8Schema),
    chartRange: chartRange.optional(() => DEFAULT_CHART_RANGE),
    calendarSort: calendarSort.optional(() => ({ ...DEFAULT_CALENDAR_SORT })),
    calendarFilter: calendarFilter.optional(() => DEFAULT_CALENDAR_FILTER),
  })
  .assert(
    state => new Set(state.calendars.map(cal => cal.id)).size === state.calendars.length,
    'expected calendar ids to be unique',
  );

export const calendarCurrentSchema = calendarV8Schema;
export const appStateCurrentSchema = appStateV8Schema;

export type CalendarV0 = v.Infer<typeof calendarV0Schema>;
export type AppStateV0 = v.Infer<typeof appStateV0Schema>;
export type CalendarV1V2 = v.Infer<typeof calendarV1V2Schema>;
export type AppStateV1V2 = v.Infer<typeof appStateV1V2Schema>;
export type CalendarV3 = v.Infer<typeof calendarV3Schema>;
export type AppStateV3 = v.Infer<typeof appStateV3Schema>;
export type CalendarV4 = v.Infer<typeof calendarV4Schema>;
export type AppStateV4 = v.Infer<typeof appStateV4Schema>;
export type CalendarV5 = v.Infer<typeof calendarV5Schema>;
export type AppStateV5 = v.Infer<typeof appStateV5Schema>;
export type CalendarV6 = v.Infer<typeof calendarV6Schema>;
export type AppStateV6 = v.Infer<typeof appStateV6Schema>;
export type CalendarV7 = v.Infer<typeof calendarV7Schema>;
export type AppStateV7 = v.Infer<typeof appStateV7Schema>;
export type CalendarV8 = v.Infer<typeof calendarV8Schema>;
export type AppStateV8 = v.Infer<typeof appStateV8Schema>;

/**
 * `Sub` unchanged, but only if it is assignable to `Super`. Used below so that
 * drift between `./types` and the current-version schema is a compile error
 * rather than something a caller discovers at runtime.
 */
type Satisfies<Super, Sub extends Super> = Sub;

export type CurrentCalendar = Satisfies<Calendar, CalendarV8>;
export type CurrentAppState = Satisfies<AppState, AppStateV8>;

/** Throws `v.ValitaError` when the value is not a version-0 state. */
export function parseAppStateV0(value: unknown): AppStateV0 {
  return appStateV0Schema.parse(value, STRIP);
}

/** Throws `v.ValitaError` when the value is not a version-1 or -2 state. */
export function parseAppStateV1V2(value: unknown): AppStateV1V2 {
  return appStateV1V2Schema.parse(value, STRIP);
}

/** Throws `v.ValitaError` when the value is not a version-3 state. */
export function parseAppStateV3(value: unknown): AppStateV3 {
  return appStateV3Schema.parse(value, STRIP);
}

/** Throws `v.ValitaError` when the value is not a version-4 state. */
export function parseAppStateV4(value: unknown): AppStateV4 {
  return appStateV4Schema.parse(value, STRIP);
}

/** Throws `v.ValitaError` when the value is not a version-5 state. */
export function parseAppStateV5(value: unknown): AppStateV5 {
  return appStateV5Schema.parse(value, STRIP);
}

/** Throws `v.ValitaError` when the value is not a version-6 state. */
export function parseAppStateV6(value: unknown): AppStateV6 {
  return appStateV6Schema.parse(value, STRIP);
}

/** Throws `v.ValitaError` when the value is not a version-7 state. */
export function parseAppStateV7(value: unknown): AppStateV7 {
  return appStateV7Schema.parse(value, STRIP);
}

/**
 * Parse a migrated state with the current-version schema, applying defaults.
 * Runs after migration on every load and on every import. Throws
 * `v.ValitaError` when the value does not satisfy the current shape.
 */
export function parseCurrentAppState(value: unknown): CurrentAppState {
  return appStateCurrentSchema.parse(value, STRIP);
}

/** The same parse for a single calendar. Throws `v.ValitaError` on failure. */
export function parseCurrentCalendar(value: unknown): CurrentCalendar {
  return calendarCurrentSchema.parse(value, STRIP);
}
