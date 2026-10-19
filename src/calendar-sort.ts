import type { Calendar, CalendarSort } from './types';

/** Latest date key with a count above zero, over full history; `null` when there is none. */
function latestCountedDate(days: Record<string, number>): string | null {
  let latest: string | null = null;
  for (const [key, count] of Object.entries(days)) {
    if (count > 0 && (latest === null || key > latest)) latest = key;
  }
  return latest;
}

function visibleTotal(days: Record<string, number>, visibleKeys: readonly string[]): number {
  let total = 0;
  for (const key of visibleKeys) total += days[key] ?? 0;
  return total;
}

/**
 * The order the calendar view shows, per `specs/04-04-calendar-sort.md` "Order". Returns a new
 * array; the input, which is the custom order, is never reordered. `Array.prototype.sort` is
 * stable, so every tie the comparators leave keeps custom order.
 */
export function sortCalendars(calendars: readonly Calendar[], sort: CalendarSort, visibleKeys: readonly string[]): Calendar[] {
  const list = [...calendars];
  const sign = sort.dir === 'desc' ? -1 : 1;
  if (sort.by === 'activities' || sort.by === 'score') {
    const value = (cal: Calendar) => visibleTotal(cal.days, visibleKeys) * (sort.by === 'score' ? cal.activityValue : 1);
    const values = new Map(list.map(cal => [cal.id, value(cal)]));
    return list.sort((a, b) => sign * (values.get(a.id)! - values.get(b.id)!));
  }
  if (sort.by === 'recent') {
    const latest = new Map(list.map(cal => [cal.id, latestCountedDate(cal.days)]));
    return list.sort((a, b) => {
      const la = latest.get(a.id)!;
      const lb = latest.get(b.id)!;
      // Calendars with no counts go last most-recent-first, and first least-recent-first.
      if (la === null || lb === null) return la === lb ? 0 : (la === null ? -sign : sign);
      if (la !== lb) return sign * (la < lb ? -1 : 1);
      return sign * (Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
    });
  }
  return list;
}
