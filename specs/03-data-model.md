# Data Model

## Calendar
```ts
interface Calendar {
  id: string;                    // stable UUID, unique across the array
  name: string;
  color: string;                 // hex
  days: Record<string, number>;  // YYYY-MM-DD -> count
  activityValue: number;
  deleted?: boolean;             // trash flag
}
```

- Counts in `days` are finite integers `>= 0`; an absent key reads as zero, and resetting a day deletes its key rather than storing `0`. A calendar's total activities is the sum of its `days` values.
- `activityValue` is a finite float of any sign, default `1.0`. Negative weights are intended — the chart's positive/negative/net split depends on them.

## AppState
```ts
type ThemeMode = 'light' | 'dark' | 'system';

interface AppState {
  version: number;
  theme: ThemeMode;
  calendars: Calendar[];
  chartRange?: '28d' | '26w';
}
```

- `version` is the `STORAGE_VERSION` of the stored shape, unrelated to the `package.json` version.
- `theme` is the persisted theme preference, nothing more. Defaults to `'system'`.
- `calendars` holds active and trashed calendars in one ordered array.
- `chartRange` is the score-chart span. Defaults to `'28d'`.

## Trash
- A trashed calendar has `deleted === true`, stays in the array, and keeps its index, so recovery returns it to its original position.
- Trashed calendars are excluded from the score chart and from every active total; active calendars are `deleted !== true`.
- Purge is per item and removes the entry outright.

## Persistence
- `JSON.stringify` of `AppState` into `localStorage` under `achievement-calendars`.
- `achievement-calendars-theme` — the theme preference.
- `achievement-calendars-last-export` — timestamp of the last full export.
- `achievement-calendars-backup` — raw pre-migration snapshot, overwritten each migration.
- localStorage disabled or over quota: surface an error banner and keep running in memory.

## Refinements
- `03-01-migrations.md` — storage version log, the stepwise migration table, per-version validation.
- `03-02-import-export.md` — the export envelope and rules for accepting imported data.
