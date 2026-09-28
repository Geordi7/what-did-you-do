# Migrations

Refines `03-data-model.md`.

## Storage version log

`STORAGE_VERSION` is the version of the persisted shape. Every version has a row here.

| Version | Shape |
|---------|-------|
| unversioned (0) | `{ id, name, days, deleted? }` per calendar; no `color` |
| 1–2 | `color` added to `Calendar`; `theme` added to `AppState`. The two cannot be distinguished from stored data, so they are documented as one range |
| 3 (current) | `activityValue` added, default `1.0` |
| 4 (planned) | `chartRange` added, default `'28d'` |

- `STORAGE_VERSION` bumps only on a change to the persisted shape.
- A bump adds its row above in the same commit as the code.

## Migration table

- Migrations are an ordered table keyed by source version:

```ts
type Migration = (state: unknown) => unknown;
const migrations: Record<number, Migration>;
```

- Steps apply stepwise from the stored version up to `STORAGE_VERSION`, one version at a time.
- No cumulative `if` blocks: each step is small and independently testable.

## Validation

- One `@badrap/valita` schema per storage version.
- Each migration step validates its input with the schema for its source version.
- "Normalize" means parse with the current-version schema, applying defaults. There is no hand-rolled normalizer and no type casts.
- Validation runs after migration on every load and on every import.

## Guards

- Before migrating, the raw stored string is snapshotted to `achievement-calendars-backup`. Single key, overwritten on each migration.
- If the stored version is greater than `STORAGE_VERSION`, the app neither loads nor saves: it shows a blocking "data from a newer version" message, so the save path cannot clobber newer data.

## Testing

- Every version bump adds a manual test to the migration test suite: seed the old shape in `localStorage`, reload, verify the result.
