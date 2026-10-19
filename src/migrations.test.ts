import { describe, expect, it } from 'vitest';
import { BACKUP_KEY, MIGRATIONS, STORAGE_VERSION, migrate } from './migrations';
import { parseCurrentAppState } from './schemas';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Narrow a migration result for field-level assertions without casting. */
function asRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`expected an object, got ${String(value)}`);
  return value;
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error('expected an array');
  return value.map(asRecord);
}

function calendarsOf(state: unknown): Record<string, unknown>[] {
  return asRecordArray(asRecord(state).calendars);
}

/**
 * A fixed instant, so the 4 -> 5 step is assertable: it takes its timestamp as
 * an argument rather than reading a clock, which is what keeps it pure.
 */
const NOW = '2026-03-04T05:06:07.890Z';
const CTX = { now: NOW };

function step(from: number): (state: unknown) => unknown {
  const migration = MIGRATIONS[from];
  if (migration === undefined) throw new Error(`no migration from version ${from}`);
  return state => migration(state, CTX);
}

/* ── fixtures, one per row of the version log in specs/03-01-migrations.md ── */

const v0State = () => ({
  calendars: [
    { id: 'v0-a', name: 'Runs', days: { '2025-01-02': 3, '2025-01-05': 1 } },
    { id: 'v0-b', name: 'Retired', days: {}, deleted: true },
  ],
});

const v1State = () => ({
  version: 1,
  calendars: [{ id: 'v1-a', name: 'Reading', color: '#40c463', days: { '2025-02-10': 2 } }],
});

const v2State = () => ({
  version: 2,
  theme: 'dark',
  calendars: [{ id: 'v2-a', name: 'Reading', color: '#40c463', days: { '2025-02-10': 2 } }],
});

const v3State = () => ({
  version: 3,
  theme: 'light',
  calendars: [
    {
      id: 'v3-a',
      name: 'Pushups',
      color: '#216e39',
      days: { '2025-03-01': 10 },
      activityValue: -2.5,
    },
  ],
});

/**
 * Typed loosely on purpose: the 4 -> 5 cases below vary one calendar field at a
 * time, including fields version 4 does not know about, and a literal-inferred
 * fixture would make each of those a type error rather than a test.
 */
type LooseState = {
  version: number;
  theme: string;
  chartRange: string;
  calendars: Record<string, unknown>[];
};

const v4State = (): LooseState => ({
  version: 4,
  theme: 'dark',
  chartRange: '26w',
  calendars: [
    {
      id: 'v4-a',
      name: 'Pushups',
      color: '#216e39',
      days: { '2025-03-01': 10, '2025-03-02': 4 },
      activityValue: 1,
    },
    { id: 'v4-b', name: 'Retired', color: '#40c463', days: {}, activityValue: 2, deleted: true },
  ],
});

const v5State = () => ({
  version: 5,
  theme: 'light',
  chartRange: '26w',
  calendars: [
    { id: 'v5-a', name: 'Runs', color: '#40c463', days: { '2025-06-02': 3 }, activityValue: 1, updatedAt: '2025-06-02T08:00:00.000Z' },
    { id: 'v5-b', name: 'Retired', color: '#216e39', days: {}, activityValue: 2, updatedAt: '2025-06-01T08:00:00.000Z', deleted: true },
  ],
});

describe('version log', () => {
  it('is at version 6 and keys the backup under a single name', () => {
    expect(STORAGE_VERSION).toBe(6);
    expect(BACKUP_KEY).toBe('achievement-calendars-backup');
  });

  it('holds one stepwise entry per from-version, and none at the current version', () => {
    expect(Object.keys(MIGRATIONS).map(Number).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(MIGRATIONS[STORAGE_VERSION]).toBeUndefined();
  });
});

describe('step 0 -> 1: color and theme', () => {
  it('adds a hex color to every calendar and the default theme to the state', () => {
    const out = asRecord(step(0)(v0State()));
    expect(out.version).toBe(1);
    expect(out.theme).toBe('system');
    const cals = calendarsOf(out);
    expect(cals.map(c => c.id)).toEqual(['v0-a', 'v0-b']);
    for (const cal of cals) expect(String(cal.color)).toMatch(HEX_COLOR);
    expect(cals[0].days).toEqual({ '2025-01-02': 3, '2025-01-05': 1 });
    expect(cals[1].deleted).toBe(true);
  });

  it('keeps a color a stored state already carried', () => {
    const out = step(0)({
      calendars: [{ id: 'a', name: 'A', color: '#40c463', days: {} }],
    });
    expect(calendarsOf(out)[0].color).toBe('#40c463');
  });

  it('accepts an explicit version 0 marker', () => {
    expect(asRecord(step(0)({ version: 0, calendars: [] })).version).toBe(1);
  });

  it('does not mutate the state it was given', () => {
    const input = v0State();
    step(0)(input);
    expect(input).toEqual(v0State());
  });

  it('rejects input that is not a version-0 state', () => {
    expect(() => step(0)({ calendars: [{ id: 'a', name: 'A', days: { '2025-01-01': -1 } }] })).toThrow();
    expect(() => step(0)({ calendars: [{ id: '', name: 'A', days: {} }] })).toThrow();
    expect(() => step(0)({ calendars: [{ id: 'a', name: 'A' }] })).toThrow();
    expect(() => step(0)({ calendars: 'nope' })).toThrow();
    expect(() => step(0)(null)).toThrow();
  });
});

describe('step 1 -> 2: marker only', () => {
  it('bumps the version and changes nothing else', () => {
    const out = asRecord(step(1)(v1State()));
    expect(out.version).toBe(2);
    expect(calendarsOf(out)).toEqual(v1State().calendars);
  });

  it('carries a stored theme through', () => {
    expect(asRecord(step(1)({ ...v1State(), theme: 'dark' })).theme).toBe('dark');
  });

  it('rejects a state that is not version 1 or 2', () => {
    expect(() => step(1)(v0State())).toThrow();
    expect(() => step(1)(v3State())).toThrow();
  });
});

describe('step 2 -> 3: activityValue', () => {
  it('defaults activityValue to 1.0 on every calendar', () => {
    const out = asRecord(step(2)(v2State()));
    expect(out.version).toBe(3);
    expect(out.theme).toBe('dark');
    expect(calendarsOf(out)[0].activityValue).toBe(1.0);
  });

  it('keeps an activity value the state already carried, negative included', () => {
    const input = v2State();
    input.calendars[0] = { ...input.calendars[0], ...{ activityValue: -2.5 } };
    expect(calendarsOf(step(2)(input))[0].activityValue).toBe(-2.5);
  });

  it('rejects a state that is not version 1 or 2', () => {
    expect(() => step(2)(v3State())).toThrow();
    expect(() => step(2)(v0State())).toThrow();
  });
});

describe('step 3 -> 4: chartRange', () => {
  it('defaults chartRange to 28d and leaves the calendars alone', () => {
    const out = asRecord(step(3)(v3State()));
    expect(out.version).toBe(4);
    expect(out.chartRange).toBe('28d');
    expect(out.theme).toBe('light');
    expect(calendarsOf(out)[0]).toEqual(v3State().calendars[0]);
  });

  it('rejects a state that is not version 3', () => {
    expect(() => step(3)(v2State())).toThrow();
    expect(() => step(3)({ ...v3State(), version: 4 })).toThrow();
  });
});

describe('step 4 -> 5: updatedAt', () => {
  it('stamps every calendar with the instant the caller supplied', () => {
    const out = asRecord(step(4)(v4State()));
    expect(out.version).toBe(5);
    expect(out.theme).toBe('dark');
    expect(out.chartRange).toBe('26w');
    const cals = calendarsOf(out);
    expect(cals.map(c => c.updatedAt)).toEqual([NOW, NOW]);
    expect(cals[1].deleted).toBe(true);
  });

  it('stamps ctx.now whatever dates a calendar holds, deriving nothing from days', () => {
    // An earlier draft of the spec derived the stamp from the calendar's latest
    // counted day. It does not: a day is a date the user entered, not a time.
    const stampFor = (days: Record<string, number>): unknown => {
      const input = v4State();
      input.calendars[0] = { ...input.calendars[0], days };
      return calendarsOf(step(4)(input))[0].updatedAt;
    };
    expect(stampFor({ '1999-12-31': 7 })).toBe(NOW);
    expect(stampFor({ '2030-06-01': 7 })).toBe(NOW);
    expect(stampFor({})).toBe(NOW);
  });

  it('is deterministic given a fixed ctx.now', () => {
    expect(step(4)(v4State())).toEqual(step(4)(v4State()));
  });

  it('keeps a parseable updatedAt the input already carried', () => {
    const carried = '2024-05-06T07:08:09.010Z';
    const input = v4State();
    input.calendars[0] = { ...input.calendars[0], updatedAt: carried };
    const cals = calendarsOf(step(4)(input));
    expect(cals[0].updatedAt).toBe(carried);
    expect(cals[1].updatedAt).toBe(NOW);
  });

  it('restamps an updatedAt that is not a parseable ISO 8601 instant', () => {
    for (const bad of ['yesterday', '2025-01-02', '2025-02-30T00:00:00Z', 17, null, '']) {
      const input = v4State();
      input.calendars[0] = { ...input.calendars[0], updatedAt: bad };
      expect(calendarsOf(step(4)(input))[0].updatedAt).toBe(NOW);
    }
  });

  it('does not mutate the state it was given', () => {
    const input = v4State();
    step(4)(input);
    expect(input).toEqual(v4State());
  });

  it('rejects a state that is not version 4', () => {
    expect(() => step(4)(v3State())).toThrow();
    expect(() => step(4)({ ...v4State(), version: 5 })).toThrow();
  });
});

describe('step 5 -> 6: calendarSort', () => {
  it('defaults calendarSort to custom order and leaves everything else alone', () => {
    const out = asRecord(step(5)(v5State()));
    expect(out.version).toBe(6);
    expect(out.calendarSort).toEqual({ by: 'custom', dir: 'desc' });
    expect(out.chartRange).toBe('26w');
    expect(out.theme).toBe('light');
    expect(out.calendars).toEqual(v5State().calendars);
  });

  it('does not mutate the state it was given', () => {
    const input = v5State();
    step(5)(input);
    expect(input).toEqual(v5State());
  });

  it('rejects a state that is not version 5', () => {
    expect(() => step(5)(v4State())).toThrow();
  });

  it('leaves duplicate ids to the current-version parse, so they fail validation, not migration', () => {
    const dup = v5State();
    dup.calendars[1].id = 'v5-a';
    const out = step(5)(dup);
    expect(() => parseCurrentAppState(out)).toThrow(/unique/);
  });
});

describe('migrate', () => {
  it('walks an unversioned state all the way to the current version', () => {
    const out = asRecord(migrate(v0State(), 0, CTX));
    expect(out.version).toBe(STORAGE_VERSION);
    expect(out.theme).toBe('system');
    expect(out.chartRange).toBe('28d');
    const cals = calendarsOf(out);
    expect(cals.map(c => c.id)).toEqual(['v0-a', 'v0-b']);
    expect(cals.map(c => c.name)).toEqual(['Runs', 'Retired']);
    for (const cal of cals) {
      expect(String(cal.color)).toMatch(HEX_COLOR);
      expect(cal.activityValue).toBe(1.0);
    }
    expect(cals[0].days).toEqual({ '2025-01-02': 3, '2025-01-05': 1 });
    expect(cals[1].deleted).toBe(true);
  });

  it('walks from version 1, defaulting the theme it predates', () => {
    const parsed = parseCurrentAppState(migrate(v1State(), 1, CTX));
    expect(parsed.version).toBe(STORAGE_VERSION);
    expect(parsed.theme).toBe('system');
    expect(parsed.chartRange).toBe('28d');
    expect(parsed.calendars[0].activityValue).toBe(1.0);
    expect(parsed.calendars[0].color).toBe('#40c463');
  });

  it('walks from version 2, keeping the stored theme', () => {
    const parsed = parseCurrentAppState(migrate(v2State(), 2, CTX));
    expect(parsed.version).toBe(STORAGE_VERSION);
    expect(parsed.theme).toBe('dark');
    expect(parsed.chartRange).toBe('28d');
    expect(parsed.calendars[0].activityValue).toBe(1.0);
  });

  it('walks from version 3, keeping a negative activity value', () => {
    const parsed = parseCurrentAppState(migrate(v3State(), 3, CTX));
    expect(parsed.version).toBe(STORAGE_VERSION);
    expect(parsed.theme).toBe('light');
    expect(parsed.chartRange).toBe('28d');
    expect(parsed.calendars[0].activityValue).toBe(-2.5);
    expect(parsed.calendars[0].updatedAt).toBe(NOW);
  });

  it('walks from version 4, keeping the stored chart range', () => {
    const parsed = parseCurrentAppState(migrate(v4State(), 4, CTX));
    expect(parsed.version).toBe(STORAGE_VERSION);
    expect(parsed.theme).toBe('dark');
    expect(parsed.chartRange).toBe('26w');
    expect(parsed.calendars.map(c => c.updatedAt)).toEqual([NOW, NOW]);
  });

  it('produces a state the current-version parse accepts, from every logged version', () => {
    const cases: [unknown, number][] = [
      [v0State(), 0],
      [v1State(), 1],
      [v2State(), 2],
      [v3State(), 3],
      [v4State(), 4],
      [v5State(), 5],
    ];
    for (const [state, from] of cases) {
      const parsed = parseCurrentAppState(migrate(state, from, CTX));
      expect(parsed.version).toBe(STORAGE_VERSION);
      if (from < 5) for (const cal of parsed.calendars) expect(cal.updatedAt).toBe(NOW);
      expect(parsed.calendarSort).toEqual({ by: 'custom', dir: 'desc' });
    }
  });

  it('treats a missing or nonsensical version marker as version 0', () => {
    for (const from of [Number.NaN, -3, 0.4]) {
      const out = asRecord(migrate(v0State(), from, CTX));
      expect(out.version).toBe(STORAGE_VERSION);
      expect(out.chartRange).toBe('28d');
    }
  });

  it('leaves a state already at the current version untouched', () => {
    const current = { version: 6, theme: 'dark', calendars: [], chartRange: '26w', calendarSort: { by: 'score', dir: 'asc' } };
    expect(migrate(current, 6, CTX)).toBe(current);
  });

  it('leaves a newer-than-current state untouched, so the load path can refuse it', () => {
    const newer = { version: 99, theme: 'dark', calendars: [] };
    expect(migrate(newer, 99, CTX)).toBe(newer);
  });

  it('leaves an Infinity marker untouched rather than treating it as unversioned', () => {
    // JSON.parse('{"version":1e999}').version is Infinity, and an untrusted import
    // supplies its own version, so this is reachable from real input.
    const newer = { version: Number.POSITIVE_INFINITY, theme: 'dark', calendars: [] };
    expect(migrate(newer, Number.POSITIVE_INFINITY, CTX)).toBe(newer);
    expect(JSON.parse('{"version":1e999}').version).toBe(Number.POSITIVE_INFINITY);
  });

  it('keeps an activityValue of 0 instead of defaulting it', () => {
    // Guards the `??` in the 2 -> 3 step: `||` would silently rewrite 0 to 1.0,
    // which is the coercion class the migration rewrite exists to remove.
    const migrated = migrate(
      { version: 2, theme: 'dark', calendars: [{ id: 'a', name: 'A', color: '#40c463', days: {}, activityValue: 0 }] },
      2,
      CTX,
    );
    expect(calendarsOf(migrated)[0].activityValue).toBe(0);
  });
});
