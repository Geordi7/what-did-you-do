import { expect, it } from 'vitest';
import { sortCalendars } from './calendar-sort';
import type { Calendar, CalendarSort } from './types';

/** The visible window: two dates. `2026-01-01` is outside it, so it counts only towards recency. */
const VISIBLE = ['2026-10-18', '2026-10-19'];

function cal(id: string, days: Record<string, number>, activityValue = 1, updatedAt = '2026-10-01T00:00:00.000Z'): Calendar {
  return { id, name: id, color: '#40c463', days, activityValue, updatedAt };
}

const ids = (cals: Calendar[]) => cals.map(c => c.id);
const sorted = (cals: Calendar[], sort: CalendarSort) => ids(sortCalendars(cals, sort, VISIBLE));

it('keeps custom order, whatever the direction, and never reorders its input', () => {
  const cals = [cal('a', { '2026-10-19': 1 }), cal('b', { '2026-10-19': 5 })];
  expect(sorted(cals, { by: 'custom', dir: 'desc' })).toEqual(['a', 'b']);
  expect(sorted(cals, { by: 'custom', dir: 'asc' })).toEqual(['a', 'b']);
  sortCalendars(cals, { by: 'activities', dir: 'desc' }, VISIBLE);
  expect(ids(cals)).toEqual(['a', 'b']);
});

it('sorts by visible activities, ignoring counts outside the window, ties in custom order', () => {
  const cals = [
    cal('a', { '2026-10-19': 2, '2026-01-01': 50 }),
    cal('b', { '2026-10-18': 3, '2026-10-19': 1 }),
    cal('c', { '2026-10-19': 2 }),
    cal('d', {}),
  ];
  expect(sorted(cals, { by: 'activities', dir: 'desc' })).toEqual(['b', 'a', 'c', 'd']);
  expect(sorted(cals, { by: 'activities', dir: 'asc' })).toEqual(['d', 'a', 'c', 'b']);
});

it('sorts by visible score, the visible total times the activity value', () => {
  const cals = [
    cal('a', { '2026-10-19': 4 }, -1),
    cal('b', { '2026-10-19': 1 }, 3),
    cal('c', { '2026-10-19': 10, '2026-01-01': 99 }, 0.5),
    cal('d', {}),
  ];
  expect(sorted(cals, { by: 'score', dir: 'desc' })).toEqual(['c', 'b', 'd', 'a']);
  expect(sorted(cals, { by: 'score', dir: 'asc' })).toEqual(['a', 'd', 'b', 'c']);
});

it('sorts most recent first by latest counted date over full history, then updatedAt, empties last', () => {
  const cals = [
    cal('empty1', {}, 1, '2026-10-19T00:00:00.000Z'),
    cal('old', { '2026-01-01': 1 }),
    cal('tieOlder', { '2026-10-18': 1 }, 1, '2026-10-02T00:00:00.000Z'),
    cal('newest', { '2026-10-19': 1, '2026-01-01': 1 }),
    cal('tieNewer', { '2026-10-18': 2 }, 1, '2026-10-05T00:00:00.000Z'),
    cal('zeroed', { '2026-10-19': 0 }, 1, '2026-10-19T12:00:00.000Z'),
    cal('empty2', {}, 1, '2026-10-01T00:00:00.000Z'),
  ];
  expect(sorted(cals, { by: 'recent', dir: 'desc' })).toEqual(['newest', 'tieNewer', 'tieOlder', 'old', 'empty1', 'zeroed', 'empty2']);
});

it('sorts least recent first with empties first in custom order, then oldest date, then oldest updatedAt', () => {
  const cals = [
    cal('newest', { '2026-10-19': 1 }),
    cal('empty1', {}, 1, '2026-10-19T00:00:00.000Z'),
    cal('tieNewer', { '2026-10-18': 2 }, 1, '2026-10-05T00:00:00.000Z'),
    cal('old', { '2026-01-01': 1 }),
    cal('tieOlder', { '2026-10-18': 1 }, 1, '2026-10-02T00:00:00.000Z'),
    cal('empty2', {}, 1, '2026-10-01T00:00:00.000Z'),
  ];
  expect(sorted(cals, { by: 'recent', dir: 'asc' })).toEqual(['empty1', 'empty2', 'old', 'tieOlder', 'tieNewer', 'newest']);
});
