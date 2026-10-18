import type { ChartRange } from './types';
import { randomColor } from './utils';
import {
  DEFAULT_ACTIVITY_VALUE,
  DEFAULT_CHART_RANGE,
  DEFAULT_THEME,
  isIsoInstant,
  parseAppStateV0,
  parseAppStateV1V2,
  parseAppStateV3,
  parseAppStateV4,
} from './schemas';

/**
 * Stepwise storage migrations.
 *
 * The version log in `specs/03-01-migrations.md` is authoritative: every row
 * there is one entry in `MIGRATIONS`, keyed by the version it migrates *from*.
 * Each step is small enough to test on its own, validates its input with the
 * schema for its source version, and changes exactly what its row describes.
 */

/** The version of the persisted shape. Bumps only when that shape changes. */
export const STORAGE_VERSION = 5;

/**
 * Single key holding the raw pre-migration string, overwritten on each
 * successful migration, before the result can overwrite the original state.
 */
export { BACKUP_KEY } from './persistence-contract';

/**
 * Supplied by the caller, so the module reads no clock of its own and every
 * step stays pure: a fixed input gives a fixed output.
 */
export type MigrationContext = { now: string };

export type Migration = (state: unknown, ctx: MigrationContext) => unknown;

/**
 * 0 -> 1: `color` on every calendar, `theme` on the state.
 *
 * A calendar that already carries a usable colour keeps it; one that does not
 * gets a fresh random colour, the same colour a new calendar would get.
 */
const migrateV0ToV1: Migration = state => {
  const prev = parseAppStateV0(state);
  return {
    version: 1,
    theme: DEFAULT_THEME,
    calendars: prev.calendars.map(cal => ({ ...cal, color: cal.color ?? randomColor() })),
  };
};

/**
 * 1 -> 2: nothing. Versions 1 and 2 cannot be distinguished from stored data,
 * so the spec documents them as one range; this step exists only so the table
 * has a row per from-version and the walk from 1 reaches 2 without a gap.
 */
const migrateV1ToV2: Migration = state => {
  const prev = parseAppStateV1V2(state);
  return { ...prev, version: 2 };
};

/** 2 -> 3: `activityValue` on every calendar, default `1.0`. */
const migrateV2ToV3: Migration = state => {
  const prev = parseAppStateV1V2(state);
  return {
    ...prev,
    version: 3,
    calendars: prev.calendars.map(cal => ({
      ...cal,
      activityValue: cal.activityValue ?? DEFAULT_ACTIVITY_VALUE,
    })),
  };
};

/** 3 -> 4: `chartRange` on the state, default `'28d'`. */
const migrateV3ToV4: Migration = state => {
  const prev = parseAppStateV3(state);
  const chartRange: ChartRange = DEFAULT_CHART_RANGE;
  return { ...prev, version: 4, chartRange };
};

/**
 * 4 -> 5: `updatedAt` on every calendar.
 *
 * `ctx.now` is the only honest value: nothing before version 5 recorded a
 * last-change time, and nothing in a calendar's contents stands in for one —
 * the latest counted day is a date the user entered, not a time the calendar
 * was edited. So every calendar is stamped with `ctx.now` whatever dates it
 * holds.
 *
 * The exception is an input that already carries a parseable `updatedAt`:
 * a real timestamp beats a synthetic one. Data this app wrote cannot reach
 * here carrying one, but a hand-edited or third-party file can.
 */
const migrateV4ToV5: Migration = (state, ctx) => {
  const prev = parseAppStateV4(state);
  return {
    ...prev,
    version: 5,
    calendars: prev.calendars.map(cal => ({
      ...cal,
      updatedAt: isIsoInstant(cal.updatedAt) ? cal.updatedAt : ctx.now,
    })),
  };
};

/** Keyed by source version; one entry per row of the version log. */
export const MIGRATIONS: Record<number, Migration> = {
  0: migrateV0ToV1,
  1: migrateV1ToV2,
  2: migrateV2ToV3,
  3: migrateV3ToV4,
  4: migrateV4ToV5,
};

/**
 * An unversioned or nonsensical marker is treated as version 0, the shape that
 * predates the marker.
 *
 * `Infinity` is the exception: a marker above the current version must fall
 * straight out of the loop, never be rewritten as "unversioned". It is reachable
 * from real input — `JSON.parse('{"version":1e999}').version` is `Infinity` — and
 * an untrusted import supplies its own version.
 */
function firstStepVersion(fromVersion: number): number {
  if (Number.isNaN(fromVersion)) return 0;
  if (fromVersion === Number.POSITIVE_INFINITY) return STORAGE_VERSION;
  const truncated = Math.trunc(fromVersion);
  return truncated < 0 ? 0 : truncated;
}

/**
 * Apply every step from `fromVersion` up to `STORAGE_VERSION`, one version at
 * a time. The result still has to be parsed with the current-version schema:
 * migration fixes shape, validation is what applies the model's constraints.
 *
 * A `fromVersion` greater than `STORAGE_VERSION` returns the state untouched.
 * Refusing to load or save newer data is the load path's job, not this one's.
 */
export function migrate(state: unknown, fromVersion: number, ctx: MigrationContext): unknown {
  const result = runMigrations(state, fromVersion, ctx);
  if (!result.ok) throw result.error;
  return result.state;
}

export function runMigrations(state: unknown, fromVersion: number, ctx: MigrationContext):
  | { ok: true; state: unknown }
  | { ok: false; failingStep: string; error: unknown } {
  let current = state;
  for (let from = firstStepVersion(fromVersion); from < STORAGE_VERSION; from++) {
    const step: Migration | undefined = MIGRATIONS[from];
    if (step === undefined) continue;
    try { current = step(current, ctx); }
    catch (error) { return { ok: false, failingStep: `${from} -> ${from + 1}`, error }; }
  }
  return { ok: true, state: current };
}
