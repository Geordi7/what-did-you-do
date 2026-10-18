# Automated Tier

Vitest over the pure modules and the store — no DOM. Merge and migration both put a user's whole
history at risk, so both belong here rather than in manual checks.

The store is covered too, because the load, save and import paths decide what reaches a user's
stored data and reading them is not enough. Tests create disposable factory instances with storage,
clock and storage-event dependencies. Independent instances and listener cleanup are covered.
The tier stays DOM-free. Components stay out — they would need jsdom and a
testing library. The browser tier reaches the import modal and the load paths in a real browser
instead; keyboard accessibility and midnight rollover are also exercised there. Visual judgements stay with `05-03-manual-checks.md`.

Run with `npm test`. The browser tier's files are invisible to this runner by name alone — nothing
configures a directory — and `05-02-browser-tier.md` owns that convention.

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
  is wrapped before migration. Where a calendar LANDS is a disposition, exercised in the browser
  tier and still walkable in `05-03-manual-checks.md`.
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
    behaviour and is exercised in the browser tier.
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
- Shared day clock — repeated midnight ticks and cancellation of the latest timer on disposal.
- `cellColor` — zero stays zero, a value at max is unaffected, and the intensity curve holds at
  25% and 50% of max.

## Persistence compatibility
- Both tiers import keys and the import cap from the persistence contract. A small independent assertion fixes the stable literal key names so a protocol rename cannot silently change every expectation.
