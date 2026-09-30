import { describe, expect, it } from 'vitest';
import type { Calendar, MergeAction } from './types';
import { mergeCalendars } from './merge';

const NOW = '2026-09-30T12:00:00Z';

const live = (over: Partial<Calendar> = {}): Calendar => ({
  id: 'cal-live',
  name: 'Live name',
  color: '#40c463',
  days: { '2025-01-01': 2, '2025-01-02': 3, '2025-01-09': 0 },
  activityValue: 2,
  updatedAt: '2025-06-01T00:00:00Z',
  ...over,
});

const imported = (over: Partial<Calendar> = {}): Calendar => ({
  // Same id: every case here is a collision, which is the only time a merge runs.
  id: 'cal-live',
  name: 'Imported name',
  color: '#ff0000',
  days: { '2025-01-02': 5, '2025-01-03': 7 },
  activityValue: 0.5,
  updatedAt: '2025-08-01T00:00:00Z',
  ...over,
});

const ACTIONS: MergeAction[] = [
  'replace',
  'merge-by-sum',
  'merge-prefer-import',
  'merge-prefer-live',
];

describe('mergeCalendars days', () => {
  it('replace lets the imported days wholly supersede the live ones', () => {
    const merged = mergeCalendars(live(), imported(), 'replace', NOW);
    expect(merged.days).toEqual({ '2025-01-02': 5, '2025-01-03': 7 });
  });

  it('merge-by-sum unions the dates and sums the ones present in both', () => {
    const merged = mergeCalendars(live(), imported(), 'merge-by-sum', NOW);
    expect(merged.days).toEqual({
      '2025-01-01': 2,
      '2025-01-02': 8,
      '2025-01-03': 7,
      '2025-01-09': 0,
    });
  });

  it('merge-prefer-import unions the dates and takes the imported count for both', () => {
    const merged = mergeCalendars(live(), imported(), 'merge-prefer-import', NOW);
    expect(merged.days).toEqual({
      '2025-01-01': 2,
      '2025-01-02': 5,
      '2025-01-03': 7,
      '2025-01-09': 0,
    });
  });

  it('merge-prefer-live unions the dates and keeps the live count for both', () => {
    const merged = mergeCalendars(live(), imported(), 'merge-prefer-live', NOW);
    expect(merged.days).toEqual({
      '2025-01-01': 2,
      '2025-01-02': 3,
      '2025-01-03': 7,
      '2025-01-09': 0,
    });
  });

  it('treats a recorded 0 as present, not as an absent date', () => {
    // A zeroed day is a day the user explicitly zeroed; an absent date was never
    // touched. Truthiness checks would collapse the two.
    const l = live({ days: { '2025-02-01': 0 } });
    const i = imported({ days: { '2025-02-01': 4, '2025-02-02': 0 } });

    expect(mergeCalendars(l, i, 'merge-by-sum', NOW).days).toEqual({
      '2025-02-01': 4,
      '2025-02-02': 0,
    });
    expect(mergeCalendars(l, i, 'merge-prefer-live', NOW).days).toEqual({
      '2025-02-01': 0,
      '2025-02-02': 0,
    });
    expect(mergeCalendars(l, i, 'merge-prefer-import', NOW).days).toEqual({
      '2025-02-01': 4,
      '2025-02-02': 0,
    });
  });

  it('keeps an imported 0 over a live count under merge-prefer-import', () => {
    const merged = mergeCalendars(
      live({ days: { '2025-03-01': 9 } }),
      imported({ days: { '2025-03-01': 0 } }),
      'merge-prefer-import',
      NOW,
    );
    expect(merged.days).toEqual({ '2025-03-01': 0 });
  });

  it('never mutates either input', () => {
    for (const action of ACTIONS) {
      const l = live();
      const i = imported();
      mergeCalendars(l, i, action, NOW);
      expect(l).toEqual(live());
      expect(i).toEqual(imported());
    }
  });
});

describe('mergeCalendars metadata', () => {
  it('lets the import win name, color and activityValue for replace', () => {
    const merged = mergeCalendars(live(), imported(), 'replace', NOW);
    expect(merged.name).toBe('Imported name');
    expect(merged.color).toBe('#ff0000');
    expect(merged.activityValue).toBe(0.5);
  });

  it('lets the import win name, color and activityValue for merge-prefer-import', () => {
    const merged = mergeCalendars(live(), imported(), 'merge-prefer-import', NOW);
    expect(merged.name).toBe('Imported name');
    expect(merged.color).toBe('#ff0000');
    expect(merged.activityValue).toBe(0.5);
  });

  it('keeps the live name, color and activityValue for merge-by-sum', () => {
    // Summing is about history: renaming a calendar the user already has would
    // be a surprise. specs/03-02-import-export.md is explicit about this row.
    const merged = mergeCalendars(live(), imported(), 'merge-by-sum', NOW);
    expect(merged.name).toBe('Live name');
    expect(merged.color).toBe('#40c463');
    expect(merged.activityValue).toBe(2);
  });

  it('keeps the live name, color and activityValue for merge-prefer-live', () => {
    const merged = mergeCalendars(live(), imported(), 'merge-prefer-live', NOW);
    expect(merged.name).toBe('Live name');
    expect(merged.color).toBe('#40c463');
    expect(merged.activityValue).toBe(2);
  });

  it('keeps a live activityValue of 0 rather than falling back to the import', () => {
    const merged = mergeCalendars(
      live({ activityValue: 0 }),
      imported(),
      'merge-by-sum',
      NOW,
    );
    expect(merged.activityValue).toBe(0);
  });
});

describe('mergeCalendars invariants', () => {
  it('keeps the live id under every action', () => {
    for (const action of ACTIONS) {
      const merged = mergeCalendars(live(), imported({ id: 'cal-live' }), action, NOW);
      expect(merged.id).toBe('cal-live');
    }
  });

  it('keeps the live deleted flag and ignores the imported one', () => {
    for (const action of ACTIONS) {
      const trashed = mergeCalendars(live({ deleted: true }), imported(), action, NOW);
      expect(trashed.deleted).toBe(true);

      const kept = mergeCalendars(live({ deleted: false }), imported({ deleted: true }), action, NOW);
      expect(kept.deleted).toBe(false);
    }
  });

  it('leaves deleted absent when the live calendar never carried it', () => {
    for (const action of ACTIONS) {
      const merged = mergeCalendars(live(), imported({ deleted: true }), action, NOW);
      expect('deleted' in merged).toBe(false);
    }
  });

  it('stamps updatedAt with the caller instant under every action', () => {
    for (const action of ACTIONS) {
      const merged = mergeCalendars(live(), imported(), action, NOW);
      expect(merged.updatedAt).toBe(NOW);
    }
  });

  it('returns a new object rather than either input', () => {
    for (const action of ACTIONS) {
      const l = live();
      const i = imported();
      const merged = mergeCalendars(l, i, action, NOW);
      expect(merged).not.toBe(l);
      expect(merged).not.toBe(i);
      expect(merged.days).not.toBe(l.days);
      expect(merged.days).not.toBe(i.days);
    }
  });
});
