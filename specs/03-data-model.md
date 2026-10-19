# Data Model

## Refinements
- `03-01-migrations.md` — storage version log, the stepwise migration table, per-version validation.
- `03-02-import-export.md` — the export envelope and rules for accepting imported data.
- `03-03-calendars.md` — the two calendar kinds, scoring and Getting Stuff Done (GSD), their
  todos, and trash.
- `03-04-gsd-points.md` — how a GSD calendar's daily points and activity counts derive from its
  todos, and the rules todos follow.

## AppState
```ts
type ThemeMode = 'light' | 'dark' | 'system';

interface CalendarSort {
  by: 'custom' | 'activities' | 'score' | 'recent';
  dir: 'desc' | 'asc';           // desc: high to low, most recent first
}

type CalendarFilter = 'all' | 'scoring' | 'gsd';

interface AppState {
  version: number;
  theme: ThemeMode;
  calendars: Calendar[];         // 03-03-calendars.md
  chartRange?: '28d' | '26w';    // '26w' names the weekly range
  calendarSort?: CalendarSort;
  calendarFilter?: CalendarFilter;
}
```

- `version` is the `STORAGE_VERSION` of the stored shape, unrelated to the `package.json` version.
- `calendars` holds active and trashed calendars of both kinds in one ordered array; ids are
  unique across it.
- Defaults: `theme` `'system'`; `chartRange` `'28d'`; `calendarSort` `{ by: 'custom', dir: 'desc' }`;
  `calendarFilter` `'all'`.

## Persistence
- `JSON.stringify` of `AppState` into `localStorage` under `achievement-calendars`.
- `achievement-calendars-theme` — the theme preference.
- `achievement-calendars-last-export` — timestamp of the last full export.
- `achievement-calendars-backup` — raw pre-migration snapshot, overwritten each migration.
- localStorage disabled or over quota: surface an error banner and keep running in memory.
