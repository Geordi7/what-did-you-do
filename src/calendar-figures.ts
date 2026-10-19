import type { Calendar } from './types';
import { gsdDays } from './gsd';

/**
 * Per-day figures for either calendar kind, so the chart, the sort and the
 * totals never branch on `kind` themselves. A scoring calendar's figures are its
 * stored counts; a GSD calendar's derive from its todos
 * (`specs/03-04-gsd-points.md`). Dates with no figure are absent.
 */

/** Activity count per date: stored counts, or root todos done. */
export function dayCounts(cal: Calendar): Record<string, number> {
  if (cal.kind === 'scoring') return cal.days;
  const counts: Record<string, number> = {};
  for (const [key, day] of Object.entries(gsdDays(cal.todos))) if (day.activities > 0) counts[key] = day.activities;
  return counts;
}

/** Score per date: count × activity value, or points earned. */
export function dayScores(cal: Calendar): Record<string, number> {
  const scores: Record<string, number> = {};
  if (cal.kind === 'scoring') {
    for (const [key, count] of Object.entries(cal.days)) scores[key] = count * cal.activityValue;
  } else {
    for (const [key, day] of Object.entries(gsdDays(cal.todos))) if (day.points > 0) scores[key] = day.points;
  }
  return scores;
}

/** Total activities over full history: the number a calendar section and an import row show. */
export function calendarTotal(cal: Calendar): number {
  return Object.values(dayCounts(cal)).reduce((a, b) => a + b, 0);
}

/**
 * Latest date with recorded activity over full history, or `null`: a count above zero on a
 * scoring calendar, any points on a GSD calendar.
 */
export function latestActiveDate(cal: Calendar): string | null {
  const figures = cal.kind === 'scoring' ? cal.days : dayScores(cal);
  let latest: string | null = null;
  for (const [key, value] of Object.entries(figures)) {
    if (value > 0 && (latest === null || key > latest)) latest = key;
  }
  return latest;
}
