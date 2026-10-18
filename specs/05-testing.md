# Testing

## Goals
- Verify calendar CRUD, reorder, trash, and recovery flows.
- Verify day increment, reset, and keyboard interaction.
- Verify persistence across reloads, migration of old stored state, and import/export round-trips.
- Verify the import review modal: every calendar in a payload listed, per-row merge choices on
  colliding rows, and rejection available on any row.
- Verify that a failed load reports itself without touching stored data, and that unavailable
  storage degrades to memory-only.
- Verify the score chart, the backup banner, and same-device cross-tab convergence.
- Verify theme and responsive layout behaviour.

## Refinements
- `05-01-automated-tier.md` — Vitest over the pure modules and the store, no DOM. `npm test`.
- `05-02-browser-tier.md` — Playwright over a real Chromium: seeded loads, import and export
  through real files, and genuine cross-tab events. Dev dependency only. `npm run test:e2e`.
- `05-03-manual-checks.md` — human procedures, and the only check on anything a script cannot judge.

A behaviour belongs to the lowest tier that can assert it honestly. Pure logic and store writes go
to the node tier; anything needing a real reload, a real file, a second tab or real pointer timing
goes to the browser tier; a judgement about how something looks stays manual.

## Failure handling
Three outcomes that must not be confused, and are covered separately.
- A migration or validation failure on load is a DEFECT: the stored string stays byte-intact, no
  save runs, the structured diagnostic is produced and can be copied or downloaded, and the app
  blocks over empty in-memory state instead of running half-loaded.
- Storage being unavailable or full is NOT a defect: the app keeps running in memory behind an error
  banner, with no blocking message. Checked manually, with storage denied or filled before load.
- An import that fails validation touches nothing — stored data byte-intact, nothing saved, no
  calendar added — and reports on the inline import status line. It raises no blocking message and
  no diagnostic. Validation precedes the review modal, so a bad payload never opens one.

## Test suites
- `03-01-T00-migration.md` — seeded loads of every old stored shape, the newer-version guard, and
  the pre-migration snapshot.
- `03-02-T00-import-export.md` — round-trip, emoji names, negative activity values, legacy exports,
  and inline reporting of a failed import.
- `03-02-T01-collisions.md` — the review modal's rows and dispositions, every merge action, and
  non-colliding imports landing undeleted. Continues the previous file's case numbering.

Both are executed by the browser tier as well as being walkable by hand.

## Build verification
- TypeScript build must pass.
- Vite production build must succeed.
- `npm run check` runs build/type checks, unit tests, dev-browser checks and production-preview smoke checks in sequence.
