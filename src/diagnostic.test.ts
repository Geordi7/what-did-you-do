import * as v from '@badrap/valita';
import { describe, expect, it } from 'vitest';
import { buildDiagnostic, formatDiagnostic } from './diagnostic';
import { parseCurrentAppState } from './schemas';

/** The error a real load failure hands `buildDiagnostic`. */
function caught(run: () => unknown): unknown {
  try {
    run();
    throw new Error('expected the parse to fail');
  } catch (err) {
    return err;
  }
}

/**
 * A payload with real user data in it: identifiable calendar names and real day
 * counts, plus one field the current schema rejects.
 */
const privatePayload = {
  version: 8,
  theme: 'dark',
  chartRange: '28d',
  calendars: [
    {
      kind: 'scoring',
      id: 'cal-a',
      name: 'Therapy sessions',
      color: 'not-a-color',
      days: { '2025-01-02': 3, '2025-01-05': 17 },
      activityValue: 1,
      updatedAt: '2025-01-05T09:00:00Z',
    },
    {
      kind: 'scoring',
      id: 'cal-b',
      name: 'Alcohol-free days',
      color: '#40c463',
      days: { '2025-02-02': 42 },
      activityValue: 1,
      updatedAt: '2025-02-02T09:00:00Z',
    },
  ],
};

describe('buildDiagnostic', () => {
  it('carries the fields the blocking message reports', () => {
    const d = buildDiagnostic({
      storedVersion: 3,
      targetVersion: 5,
      phase: 'migrate',
      failingStep: '3 -> 4',
      error: caught(() => parseCurrentAppState(privatePayload)),
      payloadBytes: 512,
    });
    expect(d.storedVersion).toBe(3);
    expect(d.targetVersion).toBe(5);
    expect(d.phase).toBe('migrate');
    expect(d.failingStep).toBe('3 -> 4');
    expect(d.payloadBytes).toBe(512);
  });

  it('extracts the validator issue paths and messages, in order', () => {
    const error = caught(() =>
      v
        .object({ a: v.string(), b: v.number() })
        .parse({ a: 1 }, { mode: 'strip' }),
    );
    const d = buildDiagnostic({
      storedVersion: 5,
      targetVersion: 5,
      phase: 'validate',
      failingStep: null,
      error,
      payloadBytes: 10,
    });
    expect(d.issues).toEqual([
      { path: '.a', message: 'invalid_type (expected string)' },
      { path: '.b', message: 'missing_value' },
    ]);
  });

  it('renders array and nested paths structurally', () => {
    const d = buildDiagnostic({
      storedVersion: 6,
      targetVersion: 6,
      phase: 'validate',
      failingStep: null,
      error: caught(() => parseCurrentAppState(privatePayload)),
      payloadBytes: 10,
    });
    expect(d.issues).toEqual([
      { path: '.calendars[0].color', message: 'expected a #rrggbb color' },
    ]);
  });

  it('reduces a non-valita error to its name, dropping a message that may quote the payload', () => {
    // JSON.parse failures quote the input ("Unexpected token 'T', \"Therapy...\""),
    // so a foreign message is exactly what must not reach the report.
    const error = caught(() => JSON.parse('{"name": Therapy}'));
    const d = buildDiagnostic({
      storedVersion: null,
      targetVersion: 5,
      phase: 'migrate',
      failingStep: null,
      error,
      payloadBytes: 17,
    });
    expect(d.issues).toEqual([{ path: '.', message: 'SyntaxError' }]);
    expect(formatDiagnostic(d)).not.toContain('Therapy');
  });

  it('survives a thrown non-Error', () => {
    const d = buildDiagnostic({
      storedVersion: null,
      targetVersion: 5,
      phase: 'migrate',
      failingStep: '0 -> 1',
      error: 'Alcohol-free days blew up',
      payloadBytes: 1,
    });
    expect(d.issues).toEqual([{ path: '.', message: 'non-Error thrown' }]);
    expect(formatDiagnostic(d)).not.toContain('Alcohol-free');
  });
});

describe('diagnostic privacy', () => {
  it('carries no calendar name and no day count, built or formatted', () => {
    const d = buildDiagnostic({
      storedVersion: 4,
      targetVersion: 5,
      phase: 'validate',
      failingStep: null,
      error: caught(() => parseCurrentAppState(privatePayload)),
      payloadBytes: JSON.stringify(privatePayload).length,
    });
    const serialized = JSON.stringify(d);
    const text = formatDiagnostic(d);

    for (const haystack of [serialized, text]) {
      // Names.
      expect(haystack).not.toContain('Therapy');
      expect(haystack).not.toContain('Alcohol');
      // Counts, which appear nowhere as standalone numbers in the report.
      expect(haystack).not.toContain('17');
      expect(haystack).not.toContain('42');
      // Nor the offending value itself.
      expect(haystack).not.toContain('not-a-color');
    }
  });
});

describe('formatDiagnostic', () => {
  it('produces one labelled line per field and one line per issue', () => {
    const text = formatDiagnostic({
      storedVersion: 4,
      targetVersion: 5,
      phase: 'validate',
      failingStep: null,
      issues: [{ path: '.calendars[0].color', message: 'expected a #rrggbb color' }],
      payloadBytes: 1234,
    });
    expect(text).toContain('storedVersion: 4');
    expect(text).toContain('targetVersion: 5');
    expect(text).toContain('phase: validate');
    expect(text).toContain('failingStep: none');
    expect(text).toContain('payloadBytes: 1234');
    expect(text).toContain('issues: 1');
    expect(text).toContain('  .calendars[0].color: expected a #rrggbb color');
  });

  it('says unknown for a stored version that could not be read', () => {
    const text = formatDiagnostic({
      storedVersion: null,
      targetVersion: 5,
      phase: 'migrate',
      failingStep: '0 -> 1',
      issues: [],
      payloadBytes: 0,
    });
    expect(text).toContain('storedVersion: unknown');
    expect(text).toContain('failingStep: 0 -> 1');
  });
});
