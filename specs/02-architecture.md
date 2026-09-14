# Architecture

SolidJS single-page app with Vite build.

## UI structure
- `src/main.tsx` mounts `App` into `#root`.
- `src/App.tsx` composes shell, calendar list, create flow, trash flow.
- `src/components/CalendarGrid.tsx` renders heatmap grid and day detail panel.

## State
- `src/store.ts` owns app state with Solid signals.
- State persists to `localStorage` under `achievement-calendars`.
- Store exposes calendar CRUD, reorder, recover, purge, and day mutation methods.
- State migration handles schema upgrades.

## Utilities
- `src/utils.ts` contains date grid helpers, color conversion, intensity coloring, and aggregate totals.

## Interaction model
- Pointer short press increments day.
- Pointer long press resets day.
- Keyboard Enter/Space increments, Backspace/Delete clears.
- Midnight timer refreshes current-day derived UI.

## Responsive behavior
- Desktop uses grid + detail side by side.
- Small screens stack detail below grid.
