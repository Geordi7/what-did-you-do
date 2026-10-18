import type { Calendar, ChartRange } from './types';
import { buildGrid, dateKey, formatDate } from './utils';

/** One active calendar's share of a column: its total count and score (count × activity value). Columns list these highest score first. */
export interface ScoreActivity { id: string; name: string; count: number; score: number }

export interface ScoreBar { key: string; label: string; pos: number; neg: number; net: number; activities: ScoreActivity[] }

export function scoreBars(calendars: readonly Calendar[], today: Date, range: ChartRange): ScoreBar[] {
  const windows = range === '26w'
    ? buildGrid(today, 26)
    : Array.from({ length: 28 }, (_, i) => [new Date(today.getFullYear(), today.getMonth(), today.getDate() - 27 + i)]);
  const active = calendars.filter(cal => !cal.deleted);
  return windows.map(dates => {
    let pos = 0;
    let neg = 0;
    const counts = active.map(() => 0);
    for (const date of dates) {
      const key = dateKey(date);
      let dayPos = 0;
      let dayNeg = 0;
      active.forEach((cal, i) => {
        const count = cal.days[key] ?? 0;
        counts[i] += count;
        const contribution = count * cal.activityValue;
        if (contribution > 0) dayPos += contribution;
        else if (contribution < 0) dayNeg += contribution;
      });
      pos += dayPos;
      neg += dayNeg;
    }
    const activities = active
      .map((cal, i) => ({ id: cal.id, name: cal.name, count: counts[i], score: counts[i] * cal.activityValue }))
      .filter(activity => activity.count !== 0)
      .sort((a, b) => b.score - a.score);
    return { key: dateKey(dates[0]), label: `${range === '26w' ? 'Week of ' : ''}${formatDate(dates[0])}`, pos, neg, net: pos + neg, activities };
  });
}

export function visibleMaximum(days: Record<string, number>, keys: readonly string[]): number {
  let max = 1;
  for (const key of keys) max = Math.max(max, days[key] ?? 0);
  return max;
}
