# Architecture

SolidJS single-page app with Vite build.

## Refinements
- `02-01-coding-standard.md` — TypeScript and Solid coding rules, and the CSS convention.
- `02-02-state-store.md` — the `createStore` state container, persistence, cross-tab sync, and the `window.__store` test affordance.

## UI structure
- `src/main.tsx` mounts `App` into `#root`.
- `src/App.tsx` composes shell, calendar list, create flow, trash flow.
- `src/components/CalendarGrid.tsx` renders heatmap grid and day detail panel.
- `src/components/HeaderMenu.tsx` is the header's ☰ menu.
- `src/components/CalendarMenu.tsx` is the per-calendar ⋮ menu.
- `src/components/menu.ts` holds the open state and keyboard behaviour both menus share.
- `src/components/ScoreChart.tsx` renders score bars over the selected range.
- `src/components/SortBar.tsx` renders the sort bar; `src/calendar-sort.ts` orders the calendar view.
- `src/components/CalendarNameInput.tsx` edits a calendar name inline.
- `src/components/ActivityValueInput.tsx` edits a calendar's activity value.
- `src/components/BackupBanner.tsx` renders the backup reminder.

## Clock
- One shared midnight clock drives every current-day and trailing-window derivation, grid and chart alike.
- App owns the clock and passes its reactive getter to chart and grids. The clock cancels its latest timer on disposal and refreshes when the tab becomes visible.

## Build
- Dependency installs are reproduced with `npm ci` from the committed lockfile; generated `node_modules/` files stay local and are ignored by Git.
- `vite.config.ts` pins `build.target` to `es2020, edge88, firefox78, chrome87, safari14` —
  Vite's `'modules'` default written out. That target is the browser baseline.

## Utilities
- `src/utils.ts` contains date grid helpers, date formatting, color conversion, intensity coloring,
  aggregate totals, id generation with a non-secure-context fallback, file download, and the shared
  click-outside helper.

## Interaction model
- Pointer short press increments day.
- Pointer long press resets day.
- Keyboard Enter/Space increments, Backspace/Delete clears.
- Hovering a date in any calendar highlights that date across all calendars.

## Responsive behavior
- Desktop uses grid + detail side by side.
- Small screens stack detail below grid.
