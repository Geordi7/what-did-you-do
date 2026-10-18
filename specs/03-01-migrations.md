# Migrations

Refines `03-data-model.md`.

## Storage version log

`STORAGE_VERSION` is the version of the persisted shape. Every version has a row here.

| Version | Shape |
|---------|-------|
| unversioned (0) | `{ id, name, days, deleted? }` per calendar; no `color` |
| 1–2 | `color` added to `Calendar`; `theme` added to `AppState`. The two cannot be distinguished from stored data, so they are documented as one range |
| 3 | `activityValue` added, default `1.0` |
| 4 | `chartRange` added, default `'28d'` |
| 5 (current) | `updatedAt` added to `Calendar`, seeded per the rule below |

- `STORAGE_VERSION` bumps only on a change to the persisted shape.
- A bump adds its row above in the same commit as the code.
- The current version is the one the store writes. A migration step may be declared in the migrations
  module before the load path imports it; the marker moves in the commit that wires it in.

## Migration table

- Migrations are an ordered table keyed by source version:

```ts
type MigrationContext = { now: string };  // ISO 8601 instant, supplied by the caller
type Migration = (state: unknown, ctx: MigrationContext) => unknown;
const migrations: Record<number, Migration>;
```

- The unit of migration is the whole persisted state — an envelope carrying its own `version`.
  A step parses its input with its source-version schema, so a bare calendar array or a lone
  calendar object must be wrapped as `{ version: 3, calendars: [...] }` before migrating.
- Steps apply stepwise from the stored version up to `STORAGE_VERSION`, one version at a time.
- No cumulative `if` blocks: each step is small and independently testable.

| Step | Effect |
|------|--------|
| 0 -> 1–2 | adds `color` to each calendar; adds `theme` to the envelope, `'system'` |
| 1–2 -> 3 | adds `activityValue`, `1.0` |
| 3 -> 4 | adds `chartRange`, `'28d'` |
| 4 -> 5 | adds `updatedAt` to each calendar |

### Seeding `updatedAt`

`updatedAt` records when a calendar was last changed. Stored data from before version 5 never
recorded that, and nothing in a calendar's contents stands in for it — the latest counted day is a
date the user entered, not a time the calendar was edited.

- The 4 -> 5 step stamps every calendar with `ctx.now`, the instant the migration ran. It is the only
  honest value available: the true last-change time was never recorded and cannot be recovered.
- Where the input already carries a parseable `updatedAt`, that value is kept rather than overwritten.
  Data this app wrote cannot reach version 5 carrying one, but a hand-edited or third-party file can,
  and a real timestamp beats a synthetic one.
- `ctx.now` is supplied by the caller. The migrations module reads no clock of its own, so every step
  stays pure and testable.

## Validation

- One `@badrap/valita` schema per storage version.
- Each migration step validates its input with the schema for its source version.
- "Normalize" means parse with the current-version schema, applying defaults. There is no hand-rolled normalizer and no type casts.
- Validation runs after migration on every load and on every import.
- From version 5 the schema requires `updatedAt` on every calendar and rejects a string that is not a
  parseable ISO 8601 instant.
- The current-version schema asserts that calendar ids are unique. The data model requires unique ids,
  so a duplicate is a defect and takes the failure path below.

## Guards

- After successful migration and before saving its result, the raw stored string is snapshotted to `achievement-calendars-backup`. Single key, overwritten on each successful migration.
- A failed snapshot leaves the original state byte-intact for the session; migrated data remains usable in memory with a storage error, and state saving stays disabled.
- If the stored version is greater than `STORAGE_VERSION`, the app neither loads nor saves: it shows a blocking "data from a newer version" message, so the save path cannot clobber newer data.

## Failure

A migration or validation failure starting from valid stored data is a defect, not a user-recoverable
state, so the app treats it as one:

- Nothing is written. The stored string stays byte-intact and the pre-migration snapshot in
  `achievement-calendars-backup` stands, so no data is lost.
- The app runs in memory from empty rather than from half-migrated state, and shows a blocking message.
- The blocking message offers a structured diagnostic, copyable to the clipboard or downloadable as a
  file, for the user to hand to a developer:

```ts
type MigrationDiagnostic = {
  storedVersion: number | null;        // version read from the payload; null when unreadable
  targetVersion: number;               // STORAGE_VERSION
  phase: 'migrate' | 'validate';       // where it failed
  failingStep: string | null;          // the step that threw, named; null when validating
  issues: { path: string; message: string }[];  // validator issues, in order, paths pre-rendered
  payloadBytes: number;                // byte length of the stored string
};
```

- The diagnostic carries no calendar names and no day counts. Failing paths and types are what debugging
  needs, and the user's own data is already in the snapshot.
- Storage being unavailable or full is a different case: the environment's fault, not a defect. It keeps
  running with an error banner rather than blocking.

## Testing

- Every version bump adds a case to the migration test suite: seed the old shape in `localStorage`, reload, verify the result. The suite is written for a human and executed by the browser tier, so the case lands in both.
