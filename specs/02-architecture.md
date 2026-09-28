# Architecture

SolidJS single-page app with Vite build.

## Refinements
- `02-01-coding-standard.md` — TypeScript and Solid coding rules, and the CSS convention.

## UI structure
- `src/main.tsx` mounts `App` into `#root`.
- `src/App.tsx` composes shell, calendar list, create flow, trash flow.
- `src/components/CalendarGrid.tsx` renders heatmap grid and day detail panel.
- `src/components/CalendarMenu.tsx` is the per-calendar "…" menu.
- `src/components/ScoreChart.tsx` renders score bars over the selected range.
- `src/components/CalendarNameInput.tsx` edits a calendar name inline.
- `src/components/ActivityValueInput.tsx` edits a calendar's activity value.
- `src/components/BackupBanner.tsx` renders the backup reminder.

## State
- `src/store.ts` owns app state with Solid signals.
- State persists to `localStorage` under `achievement-calendars`.
- Store exposes calendar CRUD, reorder, recover, permanent delete, and day mutation methods.
- State migration handles schema upgrades.

## Cross-tab sync
- One `window` `storage` listener at store init, removed on teardown. It fires only in other tabs, never the writer; the design depends on that.
- Dispatch by key — the state key migrates, validates and replaces state; the theme key updates the theme signal; the last-export key updates the export signal.
- A `null` `newValue` means another tab cleared storage; it is ignored and memory state stands.
- Loop guard: the store keeps the last written string, the save effect skips a write equal to it, and the handler sets it before replacing state.
- Focused name and activity-value inputs keep in-flight edits.
- Two tabs writing in the same event-loop turn resolve last-write-wins.

## Clock
- One shared midnight clock drives every current-day and trailing-window derivation, grid and chart alike.

## Build
- `vite.config.ts` pins `build.target` explicitly; that target is the browser baseline.

## Utilities
- `src/utils.ts` contains date grid helpers, color conversion, intensity coloring, and aggregate totals.

## Interaction model
- Pointer short press increments day.
- Pointer long press resets day.
- Keyboard Enter/Space increments, Backspace/Delete clears.
- Hovering a date in any calendar highlights that date across all calendars.

## Responsive behavior
- Desktop uses grid + detail side by side.
- Small screens stack detail below grid.
