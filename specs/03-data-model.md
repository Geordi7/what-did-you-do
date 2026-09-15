# Data Model

## Calendar
```ts
interface Calendar {
  id: string;
  name: string;
  color: string;
  days: Record<string, number>;
  deleted?: boolean;
}
```

- `id`: stable UUID identifier.
- `name`: user-editable label.
- `color`: hex color string.
- `days`: map of `YYYY-MM-DD` to integer activity count.
- `deleted`: soft-delete flag for trash flow.

## ThemeMode
```ts
type ThemeMode = 'light' | 'dark' | 'system';
```

## AppState
```ts
interface AppState {
  version?: number;
  theme?: ThemeMode;
  calendars: Calendar[];
}
```

- `version` supports migrations.
- `theme` remembers user's theme preference. Defaults to `'system'`.
- `calendars` stores active and deleted calendars in one ordered array.

## Persistence
- Serialized via `JSON.stringify` into `localStorage`.
- Storage key: `achievement-calendars`.
- Missing or old schema migrates to current version.
- Theme also persisted to `achievement-calendars-theme` key for fast access before state load.

## Derived values
- Total activities = sum of `days` values.
- Active calendars = `calendars` where `deleted !== true`.
- Deleted calendars = `calendars` where `deleted === true`.
