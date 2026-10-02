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

## Automated tier
Vitest over the pure modules and the store — no DOM. Merge and migration both put a user's whole
history at risk, so both belong here rather than in manual checks.

The store is covered too, because the load, save and import paths decide what reaches a user's
stored data and reading them is not enough. The store is a module-level singleton whose load path
runs once at import, so a test installs a `localStorage` fake on `globalThis` and fixes the clock
*before* importing it, and resets the module between scenarios to get a fresh load. That keeps the
tier DOM-free and needs no production seam. Components stay out — they would need jsdom and a
testing library, and the manual checks below cover them.

- Migrations — each step in isolation, then a stepwise run from every logged version up to current.
  - The 4 -> 5 step stamps every calendar with the timestamp the caller supplies, whatever dates the
    calendar holds, and leaves a parseable `updatedAt` already present in the input untouched. Taking
    that timestamp as an argument rather than reading a clock is what keeps the module pure, and is
    what makes the step assertable at all — a fixed input gives a fixed output.
- Schema parse — each per-version schema accepts its own shape and rejects malformed input; the
  current-version parse applies defaults and rejects a payload holding two calendars with the
  same id.
- Diagnostic — the failure builder reports the stored and target versions, the phase, the failing
  step, the validator's issue paths and the payload size, and carries no calendar name and no
  day count.
- Import — envelope, bare array, and single object are each accepted and parsed, and a legacy shape
  is wrapped before migration. Where a calendar LANDS is a disposition, so it is checked manually.
- Merge — the four merge actions as pure functions over a calendar and its day map:
  - `replace` — the imported calendar stands whole, days included.
  - `merge-by-sum`, `merge-prefer-import`, `merge-prefer-live` — the day map is the union of both
    sides' dates; a date held by both sums the two counts, takes the imported count, or keeps the
    live count.
  - Metadata — name, color and activityValue come from the import under `replace` and
    `merge-prefer-import`, and from the live calendar under `merge-prefer-live` and `merge-by-sum`.
  - Trash — a merged calendar keeps the live `deleted` flag, so no action moves a calendar into or
    out of trash.
  - Leaving a live calendar untouched is a skipped row, not a merge action; a disposition is store
    behaviour and is checked manually.
- Store — against a `localStorage` fake, with the clock injected:
  - Load: a current payload loads; an older one migrates; a newer one neither loads nor saves.
  - A migration or validation failure leaves the stored string byte-for-byte intact, writes no
    save, and leaves the previous pre-migration snapshot alone — a failing load must not overwrite
    the one backup it exists for.
  - The snapshot is written only when a step actually ran, so a boot that migrates nothing leaves it.
  - `previewImport` writes nothing, rejects an oversized payload before parsing, and reports each
    row's event total and whether its id collides.
  - `applyImport` commits every disposition as one write: skip changes nothing, append lands at the
    end undeleted, and a merge keeps the live id, index and trash state.
  - Every mutator stamps only its own calendar's `updatedAt`.
  - Unavailable or full storage surfaces an error and keeps the in-memory state usable.
  - A `storage` event from another tab converges without the write loop re-firing.
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
- `updatedAt` stamping: a count change, rename, colour change, activity-value change, soft delete,
  recover, and an applied merge each advance that calendar's last-update reading. This is a store
  mutator behaviour, not a pure function, so it sits here rather than in the automated tier, which
  excludes the store by design; the modal's last-update column is where it becomes visible.
- Export all calendars to a file, then import that file back.
- Import review modal: every calendar in the payload gets a row, colliding or not, and the event
  sum and last-update columns match what each calendar card shows.
- Import review modal by keyboard alone: focus enters on the first row's control, Tab reaches one
  control per row in payload order with none disabled, the dropdown opens and commits with the
  keyboard, focus is trapped while open, and Escape cancels and returns focus to the import control.
- A payload holding no calendars offers only Cancel, with a line saying the file holds none.
- Exercise each of the four merge actions on a colliding row, confirming the outcome reports
  afterwards on the inline import status line rather than inside the modal.
- Leave a colliding row at its rejected default, Apply, and confirm that live calendar is unchanged.
- Reject a non-colliding row, Apply, and confirm it is not added while the remaining rows land.
- Cancel the modal and confirm nothing was written, appends included.
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

## Failure handling
Two paths that must not be confused, and are covered separately.
- A migration or validation failure on load is a defect: the stored string stays byte-intact, no
  save runs, the structured diagnostic is produced and can be copied or downloaded, and the app
  blocks over empty in-memory state instead of running half-loaded. Seeded cases are scripted in
  `03-01-T00-migration.md`; the diagnostic's own contents are asserted in the automated tier.
- Storage being unavailable or full is not a defect: the app keeps running in memory behind an error
  banner, with no blocking message. Checked manually with storage denied or filled before load.
- An import that fails validation touches nothing — stored data byte-intact, nothing saved, no
  calendar added — and reports on the inline import status line. It is not a defect in stored data,
  so it raises no blocking message and no diagnostic. Validation precedes the review modal, so a
  bad payload never opens one.

## Test suites
- `03-01-T00-migration.md` — seeded loads of every old stored shape, the newer-version guard, and
  the pre-migration snapshot.
- `03-02-T00-import-export.md` — round-trip, emoji names, negative activity values, legacy exports,
  the review modal's rows and dispositions, and non-colliding imports landing undeleted.

## Build verification
- TypeScript build must pass.
- Vite production build must succeed.
