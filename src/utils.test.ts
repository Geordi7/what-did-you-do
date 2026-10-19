import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  INTENSITY_EXPONENT,
  buildGrid,
  calendarGrid,
  cellColor,
  dateKey,
  exportFilename,
  formatDate,
  newId,
  startOfWeek,
  totalActivities,
} from './utils';

/** RFC 4122 version 4, variant 1. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The next calendar day, so a sequence check never leans on elapsed milliseconds (DST). */
function nextDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + 1);
  return dateKey(date);
}

function flatKeys(weeks: Date[][]): string[] {
  return weeks.flat().map(dateKey);
}

describe('calendarGrid', () => {
  it('runs 22 weeks ending with the current week, then 4 weeks ahead', () => {
    // 2026-10-19 is a Monday; 2026-10-21 a Wednesday in the same week.
    const weeks = calendarGrid(new Date(2026, 9, 21, 15, 30));
    expect(weeks).toHaveLength(26);
    expect(dateKey(weeks[21][0])).toBe('2026-10-19');
    expect(dateKey(weeks[0][0])).toBe('2026-05-25');
    expect(dateKey(weeks[25][6])).toBe('2026-11-22');
  });
});

describe('buildGrid', () => {
  // 2025-03-12 is a Wednesday; the Monday of its week is 2025-03-10.
  const wednesday = new Date(2025, 2, 12);

  it('returns the requested number of weeks, 7 days each', () => {
    for (const numWeeks of [1, 4, 26]) {
      const weeks = buildGrid(wednesday, numWeeks);
      expect(weeks).toHaveLength(numWeeks);
      for (const week of weeks) expect(week).toHaveLength(7);
    }
  });

  it('starts every week on a Monday', () => {
    for (const week of buildGrid(wednesday, 26)) {
      expect(week[0].getDay()).toBe(1);
    }
  });

  it('runs as consecutive calendar days with no gap or repeat, across a DST change', () => {
    // A 26-week window ending 2025-03-12 spans the March DST transition.
    const keys = flatKeys(buildGrid(wednesday, 26));
    expect(keys).toHaveLength(26 * 7);
    expect(new Set(keys).size).toBe(keys.length);
    for (let i = 0; i < keys.length - 1; i++) {
      expect(keys[i + 1]).toBe(nextDayKey(keys[i]));
    }
  });

  it('puts the end date in the final week and never a week beyond it', () => {
    const weeks = buildGrid(wednesday, 4);
    const lastWeek = weeks[weeks.length - 1].map(dateKey);
    expect(lastWeek).toContain(dateKey(wednesday));
    expect(lastWeek[0]).toBe('2025-03-10');
    // The window is trailing: it closes with the end date's own week.
    expect(lastWeek[6]).toBe('2025-03-16');
    expect(flatKeys(weeks)[0]).toBe('2025-02-17'); // 2025-03-10 minus 3 weeks
  });

  it('ends exactly on a Sunday end date', () => {
    const sunday = new Date(2025, 2, 16); // Sunday
    expect(sunday.getDay()).toBe(0);
    const keys = flatKeys(buildGrid(sunday, 2));
    expect(keys[keys.length - 1]).toBe(dateKey(sunday));
    expect(keys[0]).toBe('2025-03-03');
  });

  it('opens the final week on a Monday end date', () => {
    const monday = new Date(2025, 2, 10);
    const weeks = buildGrid(monday, 3);
    expect(dateKey(weeks[2][0])).toBe(dateKey(monday));
    expect(dateKey(weeks[0][0])).toBe('2025-02-24');
  });

  it('keeps the single-week case to the end date own week', () => {
    const weeks = buildGrid(wednesday, 1);
    expect(flatKeys(weeks)).toEqual([
      '2025-03-10',
      '2025-03-11',
      '2025-03-12',
      '2025-03-13',
      '2025-03-14',
      '2025-03-15',
      '2025-03-16',
    ]);
  });
});

describe('startOfWeek', () => {
  it('treats Sunday as the last day of the week, not the first', () => {
    expect(dateKey(startOfWeek(new Date(2025, 2, 16)))).toBe('2025-03-10');
    expect(dateKey(startOfWeek(new Date(2025, 2, 10)))).toBe('2025-03-10');
    expect(dateKey(startOfWeek(new Date(2025, 2, 15)))).toBe('2025-03-10');
  });
});

describe('cellColor', () => {
  const base = '#40c463';

  it('renders the zero-activity color at or below zero, per theme', () => {
    for (const intensity of [0, -0.4, -1]) {
      expect(cellColor(base, intensity, true)).toBe('#d8dde3');
      expect(cellColor(base, intensity, false)).toBe('#2d333b');
    }
  });

  it('leaves a value at max unaffected', () => {
    expect(cellColor(base, 1, false)).toBe(base);
    expect(cellColor(base, 1, true)).toBe(base);
  });

  it('lifts 25% of max to a 50% mix, as specs/04-05-calendar-grid.md states', () => {
    // 0.25 ** 0.5 === 0.5: halfway between the zero-cell color and the calendar color.
    expect(cellColor(base, 0.25, false)).toBe('#377c4f');
    expect(cellColor(base, 0.25, true)).toBe('#8cd1a3');
  });

  it('lifts 50% of max to a 71% mix, as specs/04-05-calendar-grid.md states', () => {
    // 0.5 ** 0.5 === 0.7071...
    expect(cellColor(base, 0.5, false)).toBe('#3a9a57');
    expect(cellColor(base, 0.5, true)).toBe('#6dcb88');
  });

  it('names the curve exponent as a constant of 0.5', () => {
    expect(INTENSITY_EXPONENT).toBe(0.5);
    expect(0.25 ** INTENSITY_EXPONENT).toBeCloseTo(0.5, 12);
    expect(0.5 ** INTENSITY_EXPONENT).toBeCloseTo(0.7071067811865476, 12);
  });

  it('rises monotonically between zero and max', () => {
    // Distinctness alone would also pass for an inverted or non-monotonic curve, so
    // measure how far each step has travelled from the zero-activity background.
    const bg = [45, 51, 59];
    const distanceFromBg = (hex: string) =>
      [1, 3, 5].reduce(
        (sum, at, channel) => sum + Math.abs(parseInt(hex.substring(at, at + 2), 16) - bg[channel]),
        0,
      );

    const steps = [0.1, 0.25, 0.5, 0.75, 1].map(i => cellColor(base, i, false));
    expect(new Set(steps).size).toBe(steps.length);

    const distances = steps.map(distanceFromBg);
    for (let i = 1; i < distances.length; i++) {
      expect(distances[i]).toBeGreaterThan(distances[i - 1]);
    }
  });
});

describe('totalActivities', () => {
  it('sums the day counts', () => {
    expect(totalActivities({ '2025-01-02': 3, '2025-01-05': 1 })).toBe(4);
    expect(totalActivities({})).toBe(0);
  });
});

describe('newId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns distinct well-formed v4 ids across many calls', () => {
    const ids = Array.from({ length: 1000 }, () => newId());
    for (const id of ids) expect(id).toMatch(UUID_V4);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('still works when crypto.randomUUID is unavailable', () => {
    // Plain HTTP to a non-localhost origin: randomUUID is undefined, getRandomValues is not.
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
        return bytes;
      },
    });
    const ids = Array.from({ length: 500 }, () => newId());
    for (const id of ids) expect(id).toMatch(UUID_V4);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('still works when crypto.randomUUID throws', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => {
        throw new Error('not available on this origin');
      },
      getRandomValues: (bytes: Uint8Array) => {
        for (let i = 0; i < bytes.length; i++) bytes[i] = i * 7 + 1;
        return bytes;
      },
    });
    expect(newId()).toMatch(UUID_V4);
  });

  it('still works with no crypto at all', () => {
    vi.stubGlobal('crypto', undefined);
    const ids = Array.from({ length: 500 }, () => newId());
    for (const id of ids) expect(id).toMatch(UUID_V4);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('never throws, even with a crypto whose every entry point fails', () => {
    vi.stubGlobal('crypto', {
      randomUUID: () => {
        throw new Error('nope');
      },
      getRandomValues: () => {
        throw new Error('nope');
      },
    });
    expect(() => newId()).not.toThrow();
    expect(newId()).toMatch(UUID_V4);
  });
});

describe('formatDate', () => {
  // Pins the exact string the aria-labels and the chart tooltip depend on. This
  // function exists to reproduce the two component-local copies byte-for-byte, so
  // the format is the contract, not an implementation detail.
  it('renders weekday, short month, unpadded day and year', () => {
    expect(formatDate(new Date(2025, 2, 12))).toBe('Wed, Mar 12, 2025');
  });

  it('does not zero-pad a single-digit day', () => {
    expect(formatDate(new Date(2025, 2, 2))).toBe('Sun, Mar 2, 2025');
  });
});

describe('exportFilename', () => {
  it('stamps local date and time to the second', () => {
    expect(exportFilename(new Date(2025, 2, 12, 21, 47, 38))).toBe('calendars_2025-03-12_21-47-38.json');
  });

  it('zero-pads every field', () => {
    expect(exportFilename(new Date(2025, 0, 2, 3, 4, 5))).toBe('calendars_2025-01-02_03-04-05.json');
  });

  it('ignores milliseconds', () => {
    expect(exportFilename(new Date(2025, 0, 2, 3, 4, 5, 999))).toBe('calendars_2025-01-02_03-04-05.json');
  });
});
