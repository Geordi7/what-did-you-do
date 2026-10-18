# Browser Tier

Playwright over a real Chromium, driving the app the way a user's browser does. It exists because
every case it covers is *seed storage, reload, verify*: a real browser gives real reloads, real
`storage` events between real tabs, and real pointer timing, none of which a DOM fake reproduces.

Playwright is a DEV dependency only. Nothing ships to a user, so the local-first constraint in
`01-requirements.md` is untouched — the running app still makes no network calls.

## Harness
- Run with `npm run test:e2e`. Files are `e2e/**/*.e2e.ts`; the name keeps them out of `npm test`,
  whose Vitest run matches `*.test.ts`.
- `playwright.config.ts` starts the Vite dev server itself and points the tests at it. The dev
  server is deliberate: the CSP meta tag is build-only (`02-architecture.md`), and these cases
  assert storage and DOM behaviour, not the policy.
- Chromium only, headless, one worker — all three pinned in the config rather than inherited. The
  cases seed one origin's `localStorage`, so parallel workers would collide on it.
- Seeding runs in an `addInitScript`, which executes before any app script on the next navigation.
  Writing storage after load would race the store's own load path.
- Reads go through `localStorage` directly and through `window.__store`, the affordance
  `02-02-state-store.md` records for exactly this purpose.

## Scope
The two manual suites are the source of truth for the cases; this tier executes them.

Counts and case lists are deliberately absent below: each suite is its own source of truth, and a
file that restates them goes stale the moment a case is added.

- `03-01-T00-migration.md`, in `e2e/migration.e2e.ts` — every case in that suite.
- `03-02-T00-import-export.md` and `03-02-T01-collisions.md`, in `e2e/import-export.e2e.ts` — every
  case in both. Export is captured from the real download event and import drives the real file
  input, so each case takes the path a user's file takes.
- Cross-tab, in `e2e/cross-tab.e2e.ts`, which the node tier cannot reach at all:
  - A count change, a theme change and an export in one page land in a second page on the same
    origin, driven by real `storage` events between two pages.
  - Two pages writing in the same turn resolve last-write-wins.
- Score chart geometry, in `e2e/score-chart.e2e.ts`, in both ranges: each total bar is filled,
  width-capped, offset left of centre and anchored on the zero line on its own side; each net
  diamond is marker-sized, offset right of centre, centred on its value and classed gold, up or down by its net; the full-scale bar
  reaches the chart's edge; no mark draws outside the chart area; and a hovered column's tooltip
  sits below the chart card, centred on the column, and stays within the card's width at the
  edge columns of a narrow viewport without scrolling the page sideways. Whether colours and shapes
  read right stays manual.
- Long press, also in `e2e/cross-tab.e2e.ts`: the reset threshold `04-design.md` fixes, with real
  pointer timing rather than a faked timer.
- Midnight rollover, in `e2e/day-clock.e2e.ts`: grid and chart advance together under a controlled browser clock.
- Accessibility, in `e2e/accessibility.e2e.ts`: named inputs, menu keyboard navigation and focus return, count announcements, and focus containment in both blocking variants and import review.
- Invalid-date recovery, in `e2e/date-recovery.e2e.ts`: download of the byte-intact original payload after a protected load failure.
- File boundaries, in `e2e/file-boundary.e2e.ts`: oversized selections never reach the reader and stale callbacks cannot replace a newer preview.
- Backup reminder, in `e2e/backup-boundary.e2e.ts`: the inclusive 24-hour threshold using a fixed clock.

## Production preview
- `npm run test:preview` serves an existing production build on a separate port through `playwright.preview.config.ts`; `npm run check` builds it first.
- Files named `e2e/**/*.smoke.ts` check the emitted CSP, app mount, a persisted mutation, and absence of CSP violations. Dev checks continue to use Vite's dev server.

## Relationship to the manual suites
The manual suites stay. They are human procedures as well as assertions, and a tester reading them
remains the only check on anything a script cannot judge — whether a skipped row actually *looks*
skipped, whether a colour reads as the colour asked for, whether the blocking message is legible.
A case automated here is still worth a human's eye; it is no longer worth a human's time on every
change.

## Assertion discipline
- A case asserts the stored string byte-for-byte where its manual counterpart says byte-for-byte.
  Comparing a reparsed object would pass on a payload a user's next load would reject.
- A case that seeds storage clears every `achievement-calendars*` key first, in the same init
  script, so no case inherits another's state. A test needing a key outside that prefix — the
  cross-tab turn marker is the only one — owns clearing it, because the seed will not.
- A case whose fixture must fall inside a trailing window seeds a day key relative to the day it
  runs, and computes that key ONCE per test: recomputing it at assertion time would mismatch across
  a midnight crossing. The key is built test-side and compared against browser-side state, and the
  config pins no timezone, so both inherit the host's — deliberately, since pinning one side only
  would be worse than sharing the assumption.
