import * as v from '@badrap/valita';
import type { Diagnostic } from './types';

/**
 * The failure diagnostic of `specs/03-01-migrations.md` "Failure".
 *
 * A migration or validation failure starting from valid stored data is a
 * defect, so the blocking message offers this structured report for the user to
 * hand to a developer, copyable or downloadable.
 *
 * It carries **no calendar names and no day counts**. That is a deliberate
 * privacy property, not an oversight: failing paths and expected types are what
 * debugging needs, and the user's own data is already in the pre-migration
 * snapshot under `achievement-calendars-backup`. Everything below therefore
 * extracts issue *paths* and schema-side expectations only, and never a value
 * out of the payload.
 */

type IssueEntry = { path: string; message: string };

/** The path of an issue at the root of the payload. */
const ROOT_PATH = '.';

/**
 * A valita issue path — `['calendars', 0, 'color']` — rendered the way valita's
 * own messages render it: `.calendars[0].color`. Array and record indices are
 * structural, so they stay; a record key is a date key, never a count.
 */
function formatPath(path: readonly (string | number)[]): string {
  if (path.length === 0) return ROOT_PATH;
  return path
    .map(key => (typeof key === 'number' ? `[${key}]` : `.${key}`))
    .join('');
}

/**
 * What went wrong at one path, described from the schema's side.
 *
 * Every branch reports the issue code and, where there is one, the schema's own
 * expectation: an assertion message we wrote, the types or literals a schema
 * allows, or the names of keys a shape does not recognise. None of those come
 * from the payload's values.
 */
function describeIssue(issue: v.ValitaError['issues'][number]): string {
  switch (issue.code) {
    case 'custom_error':
      return issue.message ?? 'custom_error';
    case 'invalid_type':
      return `invalid_type (expected ${issue.expected.join(' or ')})`;
    case 'missing_value':
      return 'missing_value';
    case 'invalid_literal':
      return `invalid_literal (expected ${issue.expected.map(String).join(' or ')})`;
    case 'unrecognized_keys':
      return `unrecognized_keys (${issue.keys.join(', ')})`;
    case 'invalid_union':
      return 'invalid_union (no variant matched)';
    case 'invalid_length':
      return `invalid_length (expected ${issue.minLength}..${issue.maxLength ?? ''})`;
  }
}

/**
 * The issues of a thrown error, in order.
 *
 * A `ValitaError` exposes them directly. Anything else is reduced to its error
 * *name* alone at the root path, deliberately dropping its message: a message
 * from outside our own code can quote the input — `JSON.parse` failures do —
 * and that would put payload text into a report whose whole point is to carry
 * none.
 */
function issuesOf(error: unknown): IssueEntry[] {
  if (error instanceof v.ValitaError) {
    return error.issues.map(issue => ({
      path: formatPath(issue.path),
      message: describeIssue(issue),
    }));
  }
  if (error instanceof Error) {
    return [{ path: ROOT_PATH, message: error.name }];
  }
  return [{ path: ROOT_PATH, message: 'non-Error thrown' }];
}

/**
 * Build the diagnostic for a failed load. `error` is whatever the failing phase
 * threw; only its issue paths and schema-side expectations survive into the
 * result.
 */
export function buildDiagnostic(input: {
  storedVersion: number | null;
  targetVersion: number;
  phase: 'migrate' | 'validate';
  failingStep: string | null;
  error: unknown;
  payloadBytes: number;
}): Diagnostic {
  return {
    storedVersion: input.storedVersion,
    targetVersion: input.targetVersion,
    phase: input.phase,
    failingStep: input.failingStep,
    issues: issuesOf(input.error),
    payloadBytes: input.payloadBytes,
  };
}

/**
 * The plain text the blocking message copies to the clipboard or offers as a
 * download. One field per line, then one line per issue, so a developer can
 * read it in a bug report without tooling.
 */
export function formatDiagnostic(d: Diagnostic): string {
  const lines = [
    'Achievement Calendars — data load failure',
    `storedVersion: ${d.storedVersion ?? 'unknown'}`,
    `targetVersion: ${d.targetVersion}`,
    `phase: ${d.phase}`,
    `failingStep: ${d.failingStep ?? 'none'}`,
    `payloadBytes: ${d.payloadBytes}`,
    `issues: ${d.issues.length}`,
  ];
  for (const issue of d.issues) lines.push(`  ${issue.path}: ${issue.message}`);
  return lines.join('\n');
}
