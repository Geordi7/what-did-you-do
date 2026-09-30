import * as v from '@badrap/valita';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ACTIVITY_VALUE,
  DEFAULT_CHART_RANGE,
  DEFAULT_THEME,
  appStateV0Schema,
  appStateV1V2Schema,
  appStateV3Schema,
  appStateV4Schema,
  appStateCurrentSchema,
  isIsoInstant,
  parseCurrentAppState,
  parseCurrentCalendar,
} from './schemas';
import { totalActivities } from './utils';

const validCalendar = () => ({
  id: 'cal-a',
  name: '😱 Wins',
  color: '#40c463',
  days: { '2025-01-02': 3, '2025-01-05': 1 },
  activityValue: 1,
  updatedAt: '2025-01-05T10:20:30.400Z',
});

describe('defaults', () => {
  it('names the model defaults once', () => {
    expect(DEFAULT_THEME).toBe('system');
    expect(DEFAULT_ACTIVITY_VALUE).toBe(1.0);
    expect(DEFAULT_CHART_RANGE).toBe('28d');
  });
});

describe('current-version parse', () => {
  it('accepts a valid payload and keeps every field', () => {
    const parsed = parseCurrentAppState({
      version: 5,
      theme: 'dark',
      calendars: [validCalendar(), { ...validCalendar(), id: 'cal-b', deleted: true }],
      chartRange: '26w',
    });
    expect(parsed.version).toBe(5);
    expect(parsed.theme).toBe('dark');
    expect(parsed.chartRange).toBe('26w');
    expect(parsed.calendars).toHaveLength(2);
    expect(parsed.calendars[0].name).toBe('😱 Wins');
    expect(parsed.calendars[1].deleted).toBe(true);
    expect(totalActivities(parsed.calendars[0].days)).toBe(4);
  });

  it('supplies the defaults a bare calendar list omits', () => {
    const parsed = parseCurrentAppState({ calendars: [] });
    expect(parsed.version).toBe(5);
    expect(parsed.theme).toBe('system');
    expect(parsed.chartRange).toBe('28d');
    expect(parsed.calendars).toEqual([]);
  });

  it('defaults a calendar activityValue to 1.0', () => {
    const { activityValue, ...noValue } = validCalendar();
    expect(activityValue).toBe(1);
    const parsed = parseCurrentAppState({ calendars: [noValue] });
    expect(parsed.calendars[0].activityValue).toBe(1.0);
  });

  it('strips unknown keys rather than rejecting them', () => {
    const parsed = parseCurrentAppState({
      calendars: [{ ...validCalendar(), legacyFlag: true }],
      leftover: 'from an older build',
    });
    expect(parsed.calendars[0]).toEqual(validCalendar());
    expect(Object.keys(parsed).sort()).toEqual(['calendars', 'chartRange', 'theme', 'version']);
  });

  it('rejects a calendar with no days, instead of handing a totals helper a hole', () => {
    const { days, ...noDays } = validCalendar();
    expect(days).toBeTypeOf('object');
    expect(() => parseCurrentAppState({ calendars: [noDays] })).toThrow(v.ValitaError);
  });

  it('rejects NaN, negative, and fractional day counts', () => {
    for (const count of [Number.NaN, -1, -0.5, 1.5, Number.POSITIVE_INFINITY]) {
      expect(() =>
        parseCurrentAppState({ calendars: [{ ...validCalendar(), days: { '2025-01-02': count } }] }),
      ).toThrow(v.ValitaError);
    }
  });

  it('rejects a day key that is not YYYY-MM-DD', () => {
    for (const key of ['2025-1-2', 'yesterday', '', '2025/01/02']) {
      expect(() =>
        parseCurrentAppState({ calendars: [{ ...validCalendar(), days: { [key]: 1 } }] }),
      ).toThrow(v.ValitaError);
    }
  });

  it('accepts a negative activityValue, because any finite sign is intended', () => {
    for (const value of [-2.5, -1, 0, 0.5, 12.25]) {
      const parsed = parseCurrentAppState({
        calendars: [{ ...validCalendar(), activityValue: value }],
      });
      expect(parsed.calendars[0].activityValue).toBe(value);
    }
  });

  it('rejects a non-finite activityValue', () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() =>
        parseCurrentAppState({ calendars: [{ ...validCalendar(), activityValue: value }] }),
      ).toThrow(v.ValitaError);
    }
  });

  it('rejects an empty id, a malformed color, and a bad theme or chartRange', () => {
    expect(() => parseCurrentAppState({ calendars: [{ ...validCalendar(), id: '' }] })).toThrow(
      v.ValitaError,
    );
    for (const color of ['40c463', '#4c6', 'green', '#40c46']) {
      expect(() => parseCurrentAppState({ calendars: [{ ...validCalendar(), color }] })).toThrow(
        v.ValitaError,
      );
    }
    expect(() => parseCurrentAppState({ calendars: [], theme: 'sepia' })).toThrow(v.ValitaError);
    expect(() => parseCurrentAppState({ calendars: [], chartRange: '7d' })).toThrow(v.ValitaError);
  });

  it('rejects a state that is not an object with a calendar array', () => {
    for (const bad of [null, undefined, 'nope', 42, [], { calendars: {} }]) {
      expect(() => parseCurrentAppState(bad)).toThrow(v.ValitaError);
    }
  });

  it('rejects a stored version other than the current one', () => {
    expect(() => parseCurrentAppState({ version: 4, calendars: [] })).toThrow(v.ValitaError);
    expect(() => parseCurrentAppState({ version: 99, calendars: [] })).toThrow(v.ValitaError);
  });

  it('requires updatedAt on every calendar', () => {
    const { updatedAt, ...noStamp } = validCalendar();
    expect(updatedAt).toBeTypeOf('string');
    expect(() => parseCurrentAppState({ calendars: [noStamp] })).toThrow(v.ValitaError);
  });

  it('accepts a parseable ISO 8601 instant, offset as well as Z', () => {
    for (const stamp of [
      '2025-01-05T10:20:30.400Z',
      '2025-01-05T10:20:30Z',
      '2025-01-05T10:20Z',
      '2025-01-05T10:20:30+02:00',
      '2025-01-05T10:20:30.400-05:30',
    ]) {
      const parsed = parseCurrentAppState({ calendars: [{ ...validCalendar(), updatedAt: stamp }] });
      expect(isIsoInstant(stamp)).toBe(true);
      // Accepted leniently, then canonicalised: storage only ever holds the one form the
      // data model pins, so two equal instants are never two different strings.
      expect(parsed.calendars[0].updatedAt).toBe(new Date(stamp).toISOString());
      expect(parsed.calendars[0].updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    }
  });

  it('rejects an updatedAt that is not a parseable ISO 8601 instant', () => {
    for (const stamp of [
      '2025-01-05',
      '2025-01-05T10:20:30',
      '2025-02-30T00:00:00Z',
      'Sun Jan 05 2025',
      'yesterday',
      '',
      17,
      null,
    ]) {
      expect(() =>
        parseCurrentAppState({ calendars: [{ ...validCalendar(), updatedAt: stamp }] }),
      ).toThrow(v.ValitaError);
      expect(isIsoInstant(stamp)).toBe(false);
    }
  });

  it('rejects two calendars sharing an id, because the model requires them unique', () => {
    expect(() =>
      parseCurrentAppState({ calendars: [validCalendar(), validCalendar()] }),
    ).toThrow(v.ValitaError);
    expect(() =>
      parseCurrentAppState({
        calendars: [
          validCalendar(),
          { ...validCalendar(), id: 'cal-b' },
          { ...validCalendar(), name: 'Same id, other name' },
        ],
      }),
    ).toThrow(v.ValitaError);
    // Distinct ids are what the assert is there to let through.
    expect(
      parseCurrentAppState({
        calendars: [validCalendar(), { ...validCalendar(), id: 'cal-b' }],
      }).calendars,
    ).toHaveLength(2);
  });
});

describe('single-calendar parse', () => {
  it('accepts one calendar object and applies the activityValue default', () => {
    const { activityValue, ...noValue } = validCalendar();
    expect(activityValue).toBe(1);
    expect(parseCurrentCalendar(noValue).activityValue).toBe(1.0);
    expect(parseCurrentCalendar(validCalendar())).toEqual(validCalendar());
  });

  it('rejects a calendar missing its required fields', () => {
    expect(() => parseCurrentCalendar({ id: 'a', name: 'A' })).toThrow(v.ValitaError);
  });
});

describe('per-version schemas accept their own shape', () => {
  it('version 0: no color, no theme, version absent or 0', () => {
    expect(
      appStateV0Schema.parse(
        { calendars: [{ id: 'a', name: 'A', days: { '2025-01-01': 1 }, deleted: true }] },
        { mode: 'strip' },
      ).calendars[0].id,
    ).toBe('a');
    // A marker naming a real later version means the walk entered at the wrong step.
    expect(() => appStateV0Schema.parse({ version: 2, calendars: [] }, { mode: 'strip' })).toThrow(
      v.ValitaError,
    );
    // A marker it could not make sense of is defined to mean unversioned, so it must parse
    // here rather than block the load.
    for (const marker of [-3, 'x', Number.NaN, null]) {
      expect(
        appStateV0Schema.parse({ version: marker, calendars: [] }, { mode: 'strip' }).calendars,
      ).toEqual([]);
    }
  });

  it('version 1-2: color required, version marker 1 or 2, theme optional', () => {
    const state = {
      version: 2,
      calendars: [{ id: 'a', name: 'A', color: '#40c463', days: {} }],
    };
    expect(appStateV1V2Schema.parse(state, { mode: 'strip' }).version).toBe(2);
    expect(
      appStateV1V2Schema.parse({ ...state, version: 1 }, { mode: 'strip' }).theme,
    ).toBeUndefined();
    expect(() =>
      appStateV1V2Schema.parse(
        { version: 2, calendars: [{ id: 'a', name: 'A', days: {} }] },
        { mode: 'strip' },
      ),
    ).toThrow(v.ValitaError);
    expect(() => appStateV1V2Schema.parse({ version: 3, calendars: [] }, { mode: 'strip' })).toThrow(
      v.ValitaError,
    );
  });

  it('version 3: activityValue defaulted, no chartRange yet', () => {
    const parsed = appStateV3Schema.parse(
      { version: 3, theme: 'light', calendars: [{ id: 'a', name: 'A', color: '#40c463', days: {} }] },
      { mode: 'strip' },
    );
    expect(parsed.calendars[0].activityValue).toBe(1.0);
    expect(() => appStateV3Schema.parse({ version: 4, calendars: [] }, { mode: 'strip' })).toThrow(
      v.ValitaError,
    );
  });

  it('version 4: chartRange defaulted, updatedAt carried through untyped', () => {
    const parsed = appStateV4Schema.parse(
      {
        version: 4,
        calendars: [{ id: 'a', name: 'A', color: '#40c463', days: {}, updatedAt: 'nonsense' }],
      },
      { mode: 'strip' },
    );
    expect(parsed.chartRange).toBe('28d');
    // Kept rather than stripped or rejected, so the 4 -> 5 step can decide
    // whether it is parseable and restamp it when it is not.
    expect(parsed.calendars[0].updatedAt).toBe('nonsense');
    expect(() => appStateV4Schema.parse({ version: 5, calendars: [] }, { mode: 'strip' })).toThrow(
      v.ValitaError,
    );
  });

  it('version 5 is the current schema', () => {
    expect(appStateCurrentSchema.parse({ calendars: [] }, { mode: 'strip' }).chartRange).toBe('28d');
  });
});
