import { expect, it } from 'vitest';
import { scoreBars, visibleMaximum } from './scores';
import { buildGrid, dateKey } from './utils';
import type { GsdCalendar, ScoringCalendar } from './types';

function calendars(): ScoringCalendar[] {
  return [2, -0.5, 0, 3].map((activityValue, index) => {
    const days: Record<string, number> = {};
    for (let offset = 0; offset < 500; offset++) days[dateKey(new Date(2026, 9, 19 - offset))] = offset % 7;
    return { kind: 'scoring' as const, id: String(index), name: String(index), days, activityValue, color: '#40c463', updatedAt: '2026-10-18T00:00:00.000Z', deleted: index === 3 };
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
    const windows = range === '26w' ? buildGrid(today, 22) : Array.from({ length: 28 }, (_, i) => [new Date(2026, 9, 19 - 27 + i)]);
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

for (const range of ['28d', '26w'] as const) {
  it(`breaks each ${range} column down by active calendar with a non-zero count, highest score first`, () => {
    const today = new Date(2026, 9, 19);
    const cals = calendars();
    cals[1].days = { [dateKey(new Date(2026, 9, 18))]: 3 };
    const windows = range === '26w' ? buildGrid(today, 22) : Array.from({ length: 28 }, (_, i) => [new Date(2026, 9, 19 - 27 + i)]);
    const expected = windows.map(dates => cals
      .filter(cal => !cal.deleted)
      .map(cal => {
        const count = dates.reduce((sum, day) => sum + (cal.days[dateKey(day)] ?? 0), 0);
        return { id: cal.id, name: cal.name, count, score: count * cal.activityValue };
      })
      .filter(row => row.count !== 0)
      .sort((a, b) => b.score - a.score));
    const bars = scoreBars(cals, today, range);
    expect(bars.map(bar => bar.activities)).toEqual(expected);
    expect(bars.some(bar => bar.activities.length > 1)).toBe(true);
    // Scores 2×, 0× and -0.5× per count: sorted order differs from calendar order once all three count.
    expect(bars.some(bar => bar.activities.map(row => row.id).join() === '0,2,1')).toBe(true);
    if (range === '28d') expect(bars.some(bar => bar.activities.length === 0)).toBe(true);
  });
}

it('adds a GSD calendar\'s points as positive score, with its root todos done as its count', () => {
  const today = new Date(2026, 9, 19);
  const chores: GsdCalendar = {
    kind: 'gsd', id: 'g', name: 'Chores', color: '#40c463', defaultBounty: 1, updatedAt: '2026-10-18T00:00:00.000Z',
    todos: [
      { id: 'a', title: 'a', bounty: 2, due: '2026-10-19', created: '2026-10-18', done: '2026-10-19', children: [
        { id: 'b', title: 'b', bounty: 0.5, created: '2026-10-19', done: '2026-10-19', children: [] },
      ] },
    ],
  };
  const runs: ScoringCalendar = { kind: 'scoring', id: 'r', name: 'Runs', color: '#40c463', activityValue: -1, updatedAt: '2026-10-18T00:00:00.000Z', days: { '2026-10-19': 1 } };
  const bars = scoreBars([runs, chores], today, '28d');
  // 10-18: the root todo's creation point. 10-19: its bounty 2, the Nudge's 0.5 to create and 0.5 to finish.
  expect(bars[26]).toMatchObject({ key: '2026-10-18', pos: 1, neg: 0, net: 1 });
  expect(bars[26].activities).toEqual([{ id: 'g', name: 'Chores', count: 0, score: 1 }]);
  expect(bars[27]).toMatchObject({ key: '2026-10-19', pos: 3, neg: -1, net: 2 });
  expect(bars[27].activities).toEqual([
    { id: 'g', name: 'Chores', count: 1, score: 3 },
    { id: 'r', name: 'Runs', count: 1, score: -1 },
  ]);
});
