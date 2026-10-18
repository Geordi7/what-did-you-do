import { expect, it } from 'vitest';
import { scoreBars, visibleMaximum } from './scores';
import { buildGrid, dateKey } from './utils';
import type { Calendar, ChartRange } from './types';

function calendars(): Calendar[] {
  return [2, -0.5, 0, 3].map((activityValue, index) => {
    const days: Record<string, number> = {};
    for (let offset = 0; offset < 500; offset++) days[dateKey(new Date(2026, 9, 19 - offset))] = offset % 7;
    return { id: String(index), name: String(index), days, activityValue, color: '#40c463', updatedAt: '2026-10-18T00:00:00.000Z', deleted: index === 3 };
  });
}

for (const range of ['28d', '26w'] as const) {
  it(`matches a full-history reference for ${range}`, () => {
    const today = new Date(2026, 9, 19);
    const cals = calendars();
    const map: Record<string, { pos: number; neg: number }> = {};
    for (const cal of cals.filter(cal => !cal.deleted)) {
      for (const [key, count] of Object.entries(cal.days)) {
        const score = count * cal.activityValue;
        const day = map[key] ??= { pos: 0, neg: 0 };
        if (score > 0) day.pos += score;
        else day.neg += score;
      }
    }
    const windows = range === '26w' ? buildGrid(today, 26) : Array.from({ length: 28 }, (_, i) => [new Date(2026, 9, 19 - 27 + i)]);
    const expected = windows.map(dates => {
      const pos = dates.reduce((sum, day) => sum + (map[dateKey(day)]?.pos ?? 0), 0);
      const neg = dates.reduce((sum, day) => sum + (map[dateKey(day)]?.neg ?? 0), 0);
      return { key: dateKey(dates[0]), pos, neg, net: pos + neg };
    });
    expect(scoreBars(cals, today, range).map(({ key, pos, neg, net }) => ({ key, pos, neg, net }))).toEqual(expected);
  });
}

it('uses visible maxima without spreading a large history into arguments', () => {
  const days: Record<string, number> = {};
  for (let i = 0; i < 200000; i++) days[dateKey(new Date(2026, 9, 19 - i))] = 100;
  days['2026-10-19'] = 4;
  days['2026-10-18'] = 9;
  expect(visibleMaximum(days, ['2026-10-18', '2026-10-19'])).toBe(9);
});
