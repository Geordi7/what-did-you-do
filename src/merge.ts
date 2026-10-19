import type { Calendar, MergeAction, ScoringCalendar } from './types';
import { serializeCalendar } from './payload';

/**
 * The four collision-resolution actions of an import, as pure functions of the
 * live calendar and the imported one.
 *
 * `specs/03-02-import-export.md` "Collision resolution" is authoritative:
 *
 * | Action                 | Days                                   | Name, color, activityValue |
 * |------------------------|----------------------------------------|----------------------------|
 * | `replace`              | imported days wholly supersede live    | import wins                |
 * | `merge-by-sum`         | union of dates; both present -> sum    | live wins                  |
 * | `merge-prefer-import`  | union of dates; both present -> import | import wins                |
 * | `merge-prefer-live`    | union of dates; both present -> live   | live wins                  |
 *
 * Nothing here touches the store: a merge is decided in the review modal and
 * committed by `applyImport`, so these functions are independently testable.
 */

/**
 * Whether a date is *recorded* on a calendar, which is not the same question as
 * whether its count is non-zero. A recorded zero is a day the user explicitly
 * zeroed; an absent date is a day never touched. `merge-by-sum` over a date one
 * side records as 0 must therefore keep the other side's count rather than drop
 * the date, and `merge-prefer-import` over an imported 0 must keep that 0.
 */
function records(days: Record<string, number>, date: string): boolean {
  return Object.prototype.hasOwnProperty.call(days, date);
}

/** Every date either side records, so a union never loses a recorded zero. */
function unionDates(live: Record<string, number>, imported: Record<string, number>): string[] {
  const dates = Object.keys(live);
  for (const date of Object.keys(imported)) {
    if (!records(live, date)) dates.push(date);
  }
  return dates;
}

/**
 * The union of both day maps, with `resolve` deciding only the dates both sides
 * record. A date one side alone records keeps that side's count verbatim.
 */
function unionDays(
  live: Record<string, number>,
  imported: Record<string, number>,
  resolve: (liveCount: number, importedCount: number) => number,
): Record<string, number> {
  const merged: Record<string, number> = {};
  for (const date of unionDates(live, imported)) {
    const inLive = records(live, date);
    const inImported = records(imported, date);
    if (inLive && inImported) merged[date] = resolve(live[date], imported[date]);
    else if (inLive) merged[date] = live[date];
    else merged[date] = imported[date];
  }
  return merged;
}

function mergedDays(
  live: ScoringCalendar,
  imported: ScoringCalendar,
  action: MergeAction,
): Record<string, number> {
  switch (action) {
    case 'replace':
      return { ...imported.days };
    case 'merge-by-sum':
      return unionDays(live.days, imported.days, (a, b) => a + b);
    case 'merge-prefer-import':
      return unionDays(live.days, imported.days, (_live, importedCount) => importedCount);
    case 'merge-prefer-live':
      return unionDays(live.days, imported.days, liveCount => liveCount);
  }
}

/**
 * Whether the imported calendar's metadata wins.
 *
 * `merge-by-sum` keeps the live metadata deliberately: summing is about
 * history, and renaming a calendar the user already has would be a surprise.
 * `merge-prefer-live` keeps it for the obvious reason.
 */
function importWinsMetadata(action: MergeAction): boolean {
  return action === 'replace' || action === 'merge-prefer-import';
}

/**
 * Merge `imported` into `live` under `action`, returning a NEW calendar; both
 * arguments are left untouched.
 *
 * The result keeps the live calendar's `id` and its `deleted` flag — merging
 * never moves a calendar into or out of trash, and the caller keeps its index —
 * and stamps `updatedAt` with `now`, the caller's instant.
 */
export function mergeCalendars(live: ScoringCalendar, imported: ScoringCalendar, action: MergeAction, now: string): ScoringCalendar;
export function mergeCalendars(live: Calendar, imported: Calendar, action: MergeAction, now: string): Calendar;
export function mergeCalendars(
  live: Calendar,
  imported: Calendar,
  action: MergeAction,
  now: string,
): Calendar {
  // Todo trees do not merge: with a GSD calendar on either side, the only merge is `replace`,
  // which takes the imported calendar whole, kind included.
  if (live.kind !== 'scoring' || imported.kind !== 'scoring') {
    const replaced: Calendar = { ...serializeCalendar(imported), id: live.id, updatedAt: now };
    delete replaced.deleted;
    if (live.deleted !== undefined) replaced.deleted = live.deleted;
    return replaced;
  }
  const source = importWinsMetadata(action) ? imported : live;
  const merged: ScoringCalendar = {
    kind: 'scoring',
    id: live.id,
    name: source.name,
    color: source.color,
    days: mergedDays(live, imported, action),
    activityValue: source.activityValue,
    updatedAt: now,
  };
  // Absent and `false` are different stored shapes; only carry the flag the
  // live calendar actually had.
  if (live.deleted !== undefined) merged.deleted = live.deleted;
  return merged;
}
