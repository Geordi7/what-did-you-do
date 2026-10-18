---
id: 0005
affects:
  specs: [01-requirements.md, 02-architecture.md, 02-01-coding-standard.md, 02-02-state-store.md, 03-data-model.md, 03-01-migrations.md, 03-02-import-export.md, 04-design.md, 04-01-score-chart.md, 04-02-copy.md, 04-03-dialogs.md, 05-testing.md, 05-01-automated-tier.md, 05-02-browser-tier.md, 06-accessibility.md, 07-security-standard.md]
  paths: [src/store.ts, src/store.test.ts, src/migrations.ts, src/schemas.ts, src/types.ts, src/merge.ts, src/utils.ts, src/App.tsx, src/components/, e2e/, package.json, package-lock.json, .gitignore, node_modules/]
tags: [architecture, code-quality, review, persistence, lifecycle, accessibility, testing]
links: {related: [0002, 0003, 0004]}
---
## Outcome
Decision: adopt activities 1, 2, 3, 5, and 6 as proposed; validate real calendar dates in activity 4 while keeping previously accepted stored histories recoverable; use visible-window heatmap maxima and chart aggregation in activity 7; adopt all of activity 8, removing dependencies from the current index while retaining local files and the lockfile. Implement each as a separate activity.
Rejected:
1. New numeric limits and overflow safeguards: these values are far beyond normal use.
2. A history rewrite for dependency cleanup: the confirmed scope removes files from the current index and avoids disrupting existing clones.
3. A framework rewrite, server, sync service, or generalized repository abstraction: there is no demonstrated benefit for this local-first app.
Reopen if: numeric extremes occur in normal use, persistence scale requires a requirements change, or full-history cleanup is explicitly requested.

## Thread
> Which of the following improvement activities should we adopt, and in what order?
>
> Review requested in chat on 2026-10-13. Recommendation: address persistence safety, lifecycle correctness, and accessibility first; follow with input invariants and narrowly scoped refactoring. Each numbered proposal is an independent activity, with specifications updated before implementation. This thread proposes work; it does not authorize or apply it.
>
> **Architecture assessment.** Keep the SolidJS/Vite local-first design. The separate schema, migration, diagnostic, and merge modules give the risky data paths useful boundaries. Import preview is separated from apply, imports default to skipping collisions, failed loads protect stored data, and cross-tab reconciliation preserves calendar identity. Two runtime dependencies and a roughly 24 KB gzipped JS bundle are appropriate for the app's scope. The main maintainability pressure is the 722-line store combining payload interpretation, browser storage, reactive state, sync, CRUD, and import orchestration. File length alone is not a reason to split it.
>
> **1. High priority — make persistence failure reporting reliable.**
> `src/store.ts:60` evaluates `typeof localStorage` outside the `try` blocks in `readKey` and `writeKey` (`:266`, `:279`). A browser can expose a throwing accessor when storage is denied; that exception escapes initialization instead of producing the required memory-only banner. Move obtaining the storage object inside the guarded access path.
> `writeKey` clears the shared error after *any* successful key write (`:286`). If the large calendar payload exceeds quota but a small theme or last-export write succeeds, the banner can disappear while calendar changes remain unsaved. Track failure by key or separately track whether the current state envelope is durable; a preference write must not clear a calendar-save failure.
> The successful-migration branch (`:328`) also proceeds with the current-state save after attempting a backup, even if the backup write failed. Require a successful raw snapshot before overwriting old-version state, or retain the original storage and run migrated data in memory with the error visible. This needs an explicit persistence rule in the migration spec.
> Verification: a throwing storage getter, a fake that rejects only the state key, and a fake that rejects the backup but accepts the state key. Assert usable in-memory state, a persistent warning, and preservation of the original payload where backup failed. Current tests reject all writes together, leaving these distinctions uncovered.
>
> **2. High priority — give the midnight clock one owner and correct disposal.**
> `CalendarGrid.tsx:11` and `ScoreChart.tsx:25` independently implement `useNow`; every calendar has another timer, despite `02-architecture.md` specifying one shared clock. Both clean up only the first timeout id. After that timeout fires, recursive ticks schedule new ids that cleanup never cancels; deleting a calendar after midnight leaves its clock running.
> Create one app-owned day clock, pass its reactive getter to the chart and grids, and retain/cancel the latest timeout. Consider refreshing on visibility return so a suspended tab updates immediately on resume. Share the date-window derivation where useful without changing Monday-start or local-date semantics.
> Verification: advance across two midnights with a fake clock, dispose after the first tick, and assert no later callbacks; verify grid and chart advance together. Use the existing browser tier for a rollover interaction check.
>
> **3. High priority — complete the specified accessibility behavior.**
> `CalendarMenu.tsx:61` exposes expansion but has no menu roles, `aria-haspopup`, arrow/Home/End navigation, focus-on-open, or focus return. `CalendarGrid.tsx` changes a cell's accessible name but provides no polite count-change announcement; the live region in `App.tsx:259` announces imports only. `CalendarNameInput.tsx:41` and `ActivityValueInput.tsx:47` have no explicit accessible labels. Add the specified menu behavior and labels, and a persistent announcement region for day mutations.
> `BlockingMessage.tsx:63` returns without preventing Tab when the newer-version dialog has no buttons. Its panel can therefore lose focus to the background. `App.tsx:183` uses `aria-hidden` for the background, which does not itself prevent keyboard or programmatic focus. Make the background effectively inert and handle the zero-control trap explicitly, using a solution compatible with the project's browser baseline.
> Verification: keyboard-only menu navigation, focus return, named inputs, increment/reset announcements, and Tab/Shift+Tab in both blocking variants and the import modal. Add focused Playwright cases rather than introducing jsdom/testing-library; this respects thread 0003's dependency decision.
>
> **4. Medium priority — preserve valid numeric and date invariants after mutation.**
> `schemas.ts:73` accepts integers beyond the safe integer range; `incrementDay` (`store.ts:586`) can then add one without changing the count. Two individually finite counts can overflow in `merge.ts:69`, making `JSON.stringify` persist `null`, which the next load rejects. Finite activity values can also produce infinite contributions in `ScoreChart.tsx:49`, yielding invalid chart geometry. Validate operation results before committing an import, and define a safe count limit and score-overflow behavior without excluding negative or fractional activity values.
> `schemas.ts:77` checks day keys by regex only, accepting dates such as `2026-02-30` and `2026-99-99`; those histories cannot correspond reliably to displayed days. Reuse a real calendar-date validator. Decide how existing malformed stored data is handled before tightening load validation; introducing a new rejection must not strand previously accepted data without a recovery path.
> Verification: maximum-safe count increment, sum/product overflow, impossible dates and valid leap days, atomic import refusal, and continued acceptance of negative weights. Specify the user-facing refusal before coding it.
>
> **5. Medium priority — reject oversized files before reading them.**
> The store checks UTF-8 size before JSON parsing, which satisfies the existing parse-time guard. However, `App.tsx:129` reads every selected file fully with `FileReader.readAsText` before reaching that guard. Check `File.size` against the shared cap first to avoid loading an arbitrarily large file into memory. Keep the store's check for callers providing strings. Cancel obsolete reads or ignore stale callbacks so a slower earlier selection cannot replace a newer preview.
> Verification: an oversized file never reaches the reader or opens the modal; a newer file selection wins if callbacks complete out of order. Keep the current inline failure wording and review-before-write behavior.
>
> **6. Medium priority — introduce a disposable store factory and a shared payload boundary.**
> `store.ts:263` creates a singleton root without exposing its disposer, making the registered storage listener's cleanup unreachable through the store API. `store.test.ts:127` resets modules and installs globals for each boot. Introduce `createAppStore` with storage access, clock, and event source supplied by the caller, plus a disposer; retain a single production instance and the specified `window.__store` handle. Have tests dispose each instance and test listener cleanup.
> Extract pure payload probing, interpretation, and canonical serialization only where their responsibilities become clearer. `store.ts:183` and `migrations.ts:143` currently implement separate stepwise walks; let one migration runner report named-step failures so tested migration behavior and production diagnostics use the same traversal. Preserve the newer-version guard before any write and the one-write import transaction.
> Export storage keys and the import cap from one small contract module; both `store.test.ts` and `e2e/harness.ts` mirror them today. Keep a small explicit compatibility assertion for stable persisted key names rather than deriving every expectation from the same production constant. Make the persisted `AppState` fields required as the data-model spec already states (`types.ts:16` currently leaves version and theme optional), keeping legacy shapes represented by their version schemas.
> Verification: existing unit/browser suites plus lifecycle disposal and independent factory instances. Thread 0003 already anticipated a factory if singleton testing became awkward; thread 0004's cancelled type discussion is context, not a request to reopen its resolved getter fix.
>
> **7. Medium priority — bound computation to visible windows while retaining history.**
> `ScoreChart.tsx:42` rebuilds score maps across all recorded history after a tracked change, although it renders at most 182 days. `CalendarGrid.tsx:84` spreads every recorded count into `Math.max`, which can throw at the engine's argument limit on a large imported history. Every persistence write also sorts and serializes all calendars' day maps (`store.ts:237` onward).
> First replace the spread with an iterative maximum and aggregate chart scores by querying only the selected window. Keep full-history totals and the grid's current intensity semantics unless a separate product decision changes them. Measure mutation latency and allocations on representative large histories before introducing cached indexes or a different persistence backend. Full synchronous saves remain a scaling limit, but changing immediate localStorage persistence is a requirements decision.
> Verification: compare optimized scores with a simple reference across positive/negative weights and both ranges; exercise a large valid day map without an argument-limit exception. Record performance measurements rather than prescribing an arbitrary latency target or unmeasured caching system.
>
> **8. Lower priority — make repository and verification hygiene reproducible.**
> `git ls-files node_modules` lists 2,758 tracked dependency files even though `.gitignore` excludes that directory. Untrack generated dependencies in a separate reviewed change, retain the lockfile, and verify installation with `npm ci`. This avoids dependency churn in ordinary commits. No tracked `dist` files were found; deployment remains deferred under thread 0002.
> Add a concise check command or CI job running the existing type/build, unit, and browser checks, and a small production-preview smoke check for the build-only CSP. The current Playwright suite deliberately targets the dev server, so its green result says nothing about the built CSP. Reuse the existing tier instead of adding a broad new testing dependency. Correct the backup reminder's strict `>` comparison (`BackupBanner.tsx:26`) to the specified `>=` boundary alongside a relevant behavior check.
>
> **Suggested sequence and scope.** Implement 1–3 as separate correctness activities, then 4–5 as input-boundary activities. Do 6 once behavior is protected, 7 after measurements, and 8 as independent maintenance. Retain local-first storage, immediate saves, per-item trash confirmation, existing UI semantics, and the explicit deployment deferral. A framework rewrite, server, sync service, or generalized repository abstraction has no demonstrated benefit here.
>
> **Verification and limits.** Existing checks run for this review: `npm test` — 168 tests pass; `npm run test:e2e` — 32 Chromium tests pass; `npm run build -- --outDir /private/tmp/zed-architecture-review-build` — TypeScript and production bundling pass. Browser execution required approval to start the local server outside the sandbox. Production output was directed outside the repository. No tests or production code were changed; findings above come from code inspection, and the proposed edge cases were not reproduced by new regression tests in this review. Passing current checks does not cover those cases. No human visual/screen-reader audit, dependency vulnerability audit, or performance benchmark was performed. The pre-existing modifications to `CLAUDE.md` and dependency metadata are outside this review.

1: Accepted
2: Accepted
3: Accepted
4:
- Seems like we're talking about huge values here... any normal usage will be far far below this.
- agree on validating dates
5: Accepted
6: Accepted
7: Taking the max over the visible days is acceptable
8: There was a mistake during initial setup that caused these files to be checked in. If we can expunge them we should.

> Reading your response:
> - 1, 2, 3, 5, and 6: accepted as proposed, as separate activities in that order, with tests before implementation and specs updated first.
> - 4: validate real calendar dates; omit new numeric limits and overflow-handling work because the problematic values are far beyond normal usage. Before tightening stored-date validation, specify how previously accepted invalid dates remain recoverable.
> - 7: use only the visible grid window for the heatmap maximum, so old peaks no longer dim current activity. Bound chart aggregation to its selected window as proposed. Retain all stored history and full-history activity totals.
> - 8: remove `node_modules/` from the current Git index while retaining the installed files locally, `.gitignore`, and the lockfile. This prevents future dependency churn but leaves those files in old commits. Erasing them from all Git history would require a separate history rewrite and could disrupt other clones, so I have not interpreted “expunge” as authorizing that. I also have not assumed acceptance of the separate CI/check-command, production-CSP smoke-check, or backup-boundary proposals bundled into item 8.
>
> Please confirm this reading and mark it “decided” to resolve the thread. For item 8, specify whether you want current-index cleanup only or removal from all Git history, and whether to include the remaining verification/backup-boundary proposals. If you want numeric overflow safeguards despite excluding new limits, say so under item 4.
>
> Holding implementation until that clarification: `00-meta.md` requires confirmation of terse or ambiguous answers before applying them, and an explicit operator decision before moving A → R. No other thread needs a response or has a resolved decision awaiting application; thread 0002 remains deferred.

Accept the rest of item 8 as-is

If there are no other clarifications needed, this is decided.

> Confirmed and decided. Applying the eight independent activities, including all remaining verification and backup-boundary work in item 8. Dependency cleanup uses the confirmed current-index scope. Previously accepted malformed dates will retain their original stored payload and offer a raw-data download for repair before stricter validation is applied.
