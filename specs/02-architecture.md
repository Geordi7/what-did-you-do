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
- `src/components/NumberMenuInput.tsx` edits a menu's number: activity value or default bounty.
- `src/components/BackupBanner.tsx` renders the backup reminder.
- `src/components/TodoPage.tsx` is a GSD calendar's todo page, shown in place of the list.

## Calendar kinds
- `src/gsd.ts` derives a GSD calendar's per-day figures from its todo tree and holds the todo
  rules, as pure functions over a todo array.
- `src/calendar-figures.ts` gives per-day counts and scores for either kind, so chart, sort and
  totals never branch on `kind`.

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

## Routes
- `src/route.ts` reads the URL hash: no hash is the calendar list, `#/gsd/<id>` a GSD calendar's
  todo page. Hash URLs need no server rewrite, so they work on any host and from `file://`.

## Interaction
- Day actions are in `04-05-calendar-grid.md`. Hovering a date in any calendar highlights that
  date across all calendars.
