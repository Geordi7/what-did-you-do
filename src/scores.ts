import type { Calendar, ChartRange } from './types';
import { buildGrid, dateKey, formatDate } from './utils';

export interface ScoreBar { key: string; label: string; pos: number; neg: number; net: number }

export function scoreBars(calendars: readonly Calendar[], today: Date, range: ChartRange): ScoreBar[] {
  const windows = range === '26w'
    ? buildGrid(today, 26)
    : Array.from({ length: 28 }, (_, i) => [new Date(today.getFullYear(), today.getMonth(), today.getDate() - 27 + i)]);
  const active = calendars.filter(cal => !cal.deleted);
  return windows.map(dates => {
    let pos = 0;
    let neg = 0;
    for (const date of dates) {
      const key = dateKey(date);
      let dayPos = 0;
      let dayNeg = 0;
      for (const cal of active) {
        const contribution = (cal.days[key] ?? 0) * cal.activityValue;
        if (contribution > 0) dayPos += contribution;
        else if (contribution < 0) dayNeg += contribution;
      }
      pos += dayPos;
      neg += dayNeg;
    }
    return { key: dateKey(dates[0]), label: `${range === '26w' ? 'Week of ' : ''}${formatDate(dates[0])}`, pos, neg, net: pos + neg };
  });
}

export function visibleMaximum(days: Record<string, number>, keys: readonly string[]): number {
  let max = 1;
  for (const key of keys) max = Math.max(max, days[key] ?? 0);
  return max;
}
