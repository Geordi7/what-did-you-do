# Test Suite: Migration

Manual suite for `03-01-migrations.md`. Run the cases in order.

Every `STORAGE_VERSION` bump adds a case here: seed the old shape, reload, verify.

The browser tier executes these cases too, in `e2e/migration.e2e.ts` (`05-02-browser-tier.md`). This file stays
the source of truth: a case is added here first and the tier follows, and walking it by hand remains
the check on anything a script cannot judge.

## Preparation
- Use a browser profile whose storage for this origin can be discarded, or export a backup first.
- Keep devtools open on Application → Local Storage for the app origin.
- Before each case: delete every `achievement-calendars*` key, seed exactly the JSON the case gives
  under `achievement-calendars`, then reload the page.
- After each case: read back `achievement-calendars` and `achievement-calendars-backup` before
  moving on.

## Case 1 — unversioned (0)
1. Seed:
```json
{"calendars":[
  {"id":"v0-a","name":"Runs","days":{"2025-01-02":3,"2025-01-05":1}},
  {"id":"v0-b","name":"Retired","days":{},"deleted":true}
]}
```
2. Reload.
3. Verify the app loads with one active calendar, `Runs`, total 4, and one item in trash, `Retired`.
4. Verify `Runs` has a color, and an activity value of `1.0`.
5. Read back `achievement-calendars`: `version` is `STORAGE_VERSION`, `theme` is `'system'`, and
   both calendars keep their original order and ids, `chartRange` reads `'28d'`, and every calendar
   has an `updatedAt` stamped with the moment of the reload.
6. Verify `achievement-calendars-backup` holds the seed string verbatim.

## Case 2 — versions 1–2
1. Seed:
```json
{"version":2,"theme":"dark","calendars":[
  {"id":"v2-a","name":"Reading","color":"#40c463","days":{"2025-02-10":2}}
]}
```
2. Reload.
3. Verify the dark theme is applied and the header menu marks Dark as the checked theme.
4. Verify `Reading` keeps color `#40c463` and gains an activity value of `1.0`.
5. Read back `achievement-calendars`: `version` is `STORAGE_VERSION`, `chartRange` reads `'28d'`,
   and `Reading` has an `updatedAt`.
6. Repeat steps 1–5 with `"version":1` and no `theme` key; the theme resolves to `'system'`.

## Case 3 — version 3
1. Seed, writing `<today>` as the date you run this on, in `YYYY-MM-DD` local time, so the counted
   day sits inside the chart's trailing 28-day window:
```json
{"version":3,"theme":"light","calendars":[
  {"id":"v3-a","name":"Pushups","color":"#216e39","days":{"<today>":10},"activityValue":-2.5}
]}
```
2. Reload.
3. Verify the activity value reads `-2.5`, and that the chart's last bar — today — shows the day as
   negative score: a negative component of `-25.0`, no positive component, net `-25.0`.
4. Read back `achievement-calendars`: `version` is `STORAGE_VERSION`, `chartRange` reads `'28d'`,
   and `Pushups` has an `updatedAt`.

## Case 4 — version 4 -> 5
1. Seed:
```json
{"version":4,"theme":"light","chartRange":"26w","calendars":[
  {"id":"v4-a","name":"Swims","color":"#40c463","days":{"2025-06-02":1,"2025-06-09":4},"activityValue":1},
  {"id":"v4-b","name":"Empty","color":"#216e39","days":{},"activityValue":1}
]}
```
2. Reload.
3. Read back `achievement-calendars`: `version` is `STORAGE_VERSION` and every calendar has an
   `updatedAt`.
4. Verify BOTH calendars seed the same `updatedAt`: an instant at about the moment of the reload.
   The true last-change time was never recorded, so the migration stamps when it ran, and the dates a
   calendar holds do not influence it — `v4-a` has counted days and `v4-b` has none, and they seed
   alike.
5. Repeat with a hand-edited seed where `v4-a` already carries `"updatedAt":"2024-01-15T09:30:00.000Z"`.
   Verify that value survives untouched and only `v4-b` is stamped with the reload instant.
6. Verify `chartRange` still reads `'26w'` — the step adds a field and changes nothing else.
7. Verify `achievement-calendars-backup` holds the seed string verbatim.
8. Reload again without changing storage: the state is already at `STORAGE_VERSION`, so no migration
   runs, the snapshot is unchanged, and no `updatedAt` is restamped.

## Case 5 — newer version refuses to load
1. Seed a state whose `version` is greater than `STORAGE_VERSION`:
```json
{"version":99,"theme":"dark","calendars":[
  {"id":"vNext-a","name":"Future","color":"#216e39","days":{"2025-04-01":1},"activityValue":1}
]}
```
2. Reload.
3. Verify a blocking "data from a newer version" message is shown and no calendar is rendered.
4. Wait a few seconds, interact with whatever the message offers, then read back
   `achievement-calendars`: the stored string is byte-for-byte the seed. Nothing was saved over it.
5. Reload again and verify the same message, still with the seed intact.

## Case 6 — pre-migration snapshot
1. Seed the Case 1 JSON, reload, and record `achievement-calendars-backup`.
2. Verify it equals the Case 1 seed exactly, not the migrated state.
3. Without clearing anything, seed the Case 3 JSON over `achievement-calendars` and reload.
4. Verify `achievement-calendars-backup` now holds the Case 3 seed: one key, overwritten per
   migration, no history kept.
5. Reload once more without changing storage — the state is already at `STORAGE_VERSION`, so
   nothing is migrated and the snapshot is unchanged.

## Case 7 — validation failure is a defect
1. Seed a payload that is well-formed JSON but violates the current-version schema — two calendars
   sharing one id:
```json
{"version":3,"theme":"light","calendars":[
  {"id":"dup-a","name":"One","color":"#40c463","days":{"2025-05-01":1},"activityValue":1},
  {"id":"dup-a","name":"Two","color":"#216e39","days":{"2025-05-02":2},"activityValue":1}
]}
```
2. Reload.
3. Verify a blocking message is shown, no calendar is rendered, and the app is running from empty
   in memory rather than from part of the seed.
4. Read back `achievement-calendars`: the stored string is byte-for-byte the seed. Nothing was
   written over it.
5. Read back `achievement-calendars-backup`: it is **absent or unchanged**. The seed is already at
   the current version, so no migration ran and no snapshot was taken — the guarantee here is that
   `achievement-calendars` itself is intact, which step 4 checks.
6. Obtain the diagnostic from the blocking message, by copy and by download.
7. Verify it names the stored version, the target version, the phase, the failing step, the issue
   paths and the payload size — and that it contains no calendar name and no day counts.
   The id-uniqueness check is asserted over the whole envelope, so its issue path is the root `.`,
   not the offending calendar's index. A root path is the expected reading here.
8. Reload again and verify the same message, still with the seed intact.

Storage being unavailable or full is not this case: it shows an error banner and keeps running, and
is tested with the storage-unavailable behaviour, not here.
