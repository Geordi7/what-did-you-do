# Testing

## Goals
- Verify calendar CRUD, reorder, trash, and recovery flows.
- Verify day increment, reset, and keyboard interaction.
- Verify persistence across reloads, migration of old stored state, and import/export round-trips.
- Verify the score chart, the backup banner, and same-device cross-tab convergence.
- Verify theme and responsive layout behaviour.

## Automated tier
Vitest over the pure modules only — no DOM, no store, no wall clock.

- Migrations — each step in isolation, then a stepwise run from every logged version up to current.
- Schema parse — each per-version schema accepts its own shape and rejects malformed input; the
  current-version parse applies defaults.
- Import — envelope, bare array, and single object; id collision; imported calendars land undeleted.
- `buildGrid` — trailing-window boundaries, Monday-start weeks, month labels.
- `cellColor` — zero stays zero, a value at max is unaffected, and the intensity curve holds at
  25% and 50% of max.

## Manual checks
- Add new calendar.
- Rename calendar.
- Change calendar color.
- Set a calendar's activity value, including a negative one.
- Move calendar up and down.
- Click day to increment count.
- Long-press day to reset count.
- Use keyboard Enter, Space, Backspace, Delete on focused cell.
- Delete calendar, then recover it, and confirm it returns to its original position.
- Delete forever on a single trashed calendar, through its confirmation.
- Export all calendars to a file, then import that file back.
- Reload page and confirm state persists.
- Toggle theme light/dark/system and confirm heatmap zero cells adapt.
- Reload after theme change and confirm preference persists.
- Switch the chart range between 28 days and 26 weeks, then reload and confirm the choice persists.
- Hover a date in one calendar and confirm the same date highlights in every calendar.
- Backup banner: with a last export 24 or more hours old it appears on load; exporting now hides it;
  dismissing hides it for the rest of the session.
- Midnight rollover: with the app left open across midnight, the today marker and the chart's
  trailing window both advance without a reload.
- Cross-tab sync: with two tabs open on the same device, a count change, a theme change, and an
  export in one tab all land in the other; clearing storage in one tab leaves the other's in-memory
  state standing.
- Responsive: narrow the viewport and confirm the detail panel stacks below the grid with no
  sideways scrolling.

## Test suites
- `03-01-T00-migration.md` — seeded loads of every old stored shape, the newer-version guard, and
  the pre-migration snapshot.
- `03-02-T00-import-export.md` — round-trip, emoji names, negative activity values, legacy exports,
  id collision, and imports landing undeleted.

## Build verification
- TypeScript build must pass.
- Vite production build must succeed.
