# Data Model

## Calendar
```ts
interface Calendar {
  id: string;                    // stable UUID, unique across the array
  name: string;
  color: string;                 // hex
  days: Record<string, number>;  // YYYY-MM-DD -> count
  activityValue: number;
  updatedAt: string;             // ISO 8601 instant
  deleted?: boolean;             // trash flag
}
```

- Counts in `days` are finite integers `>= 0`; an absent key reads as zero, and resetting a day deletes its key rather than storing `0`. A calendar's total activities is the sum of its `days` values.
- Day keys are real Gregorian calendar dates in `YYYY-MM-DD` form, including valid leap days.
- `activityValue` is a finite float of any sign, default `1.0`. Negative weights are intended — the chart's positive/negative/net split depends on them.
- `updatedAt` is an ISO 8601 instant (`YYYY-MM-DDTHH:mm:ss.sssZ`, UTC) recording when the calendar was last changed, restamped on a day count, rename, colour, activity value, soft delete, recover, or a merge that alters it. It is a wall-clock time, unrelated to which dates the calendar holds. A change to another calendar leaves it alone.

## AppState
```ts
type ThemeMode = 'light' | 'dark' | 'system';

interface CalendarSort {
  by: 'custom' | 'activities' | 'score' | 'recent';
  dir: 'desc' | 'asc';           // desc: high to low, most recent first
}

interface AppState {
  version: number;
  theme: ThemeMode;
  calendars: Calendar[];
  chartRange?: '28d' | '26w';   // '26w' names the weekly range
  calendarSort?: CalendarSort;
}
```

- `version` is the `STORAGE_VERSION` of the stored shape, unrelated to the `package.json` version.
- `calendars` holds active and trashed calendars in one ordered array.
- `theme` is the persisted theme preference, default `'system'`; `chartRange` is the score-chart span, default `'28d'`;
  `calendarSort` is the sort bar's selection, default `{ by: 'custom', dir: 'desc' }`.

## Trash
- A trashed calendar has `deleted === true`, stays in the array, and keeps its index, so recovery returns it to its original position.
- Trashed calendars are excluded from the score chart and from every active total; active calendars are `deleted !== true`. Purge is per item and removes the entry outright.

## Persistence
- `JSON.stringify` of `AppState` into `localStorage` under `achievement-calendars`.
- `achievement-calendars-theme` — the theme preference.
- `achievement-calendars-last-export` — timestamp of the last full export.
- `achievement-calendars-backup` — raw pre-migration snapshot, overwritten each migration.
- localStorage disabled or over quota: surface an error banner and keep running in memory.

## Refinements
- `03-01-migrations.md` — storage version log, the stepwise migration table, per-version validation.
- `03-02-import-export.md` — the export envelope and rules for accepting imported data.
