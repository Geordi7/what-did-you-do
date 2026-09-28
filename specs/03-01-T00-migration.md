# Test Suite: Migration

Manual suite for `03-01-migrations.md`. Run the cases in order.

Every `STORAGE_VERSION` bump adds a case here: seed the old shape, reload, verify.

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
5. Read back `achievement-calendars`: `version` is `STORAGE_VERSION`, `theme` is `'system'`,
   `chartRange` is `'28d'`, and both calendars keep their original order and ids.
6. Verify `achievement-calendars-backup` holds the seed string verbatim.

## Case 2 — versions 1–2
1. Seed:
```json
{"version":2,"theme":"dark","calendars":[
  {"id":"v2-a","name":"Reading","color":"#40c463","days":{"2025-02-10":2}}
]}
```
2. Reload.
3. Verify the dark theme is applied and the theme selector reads Dark.
4. Verify `Reading` keeps color `#40c463` and gains an activity value of `1.0`.
5. Read back `achievement-calendars`: `version` is `STORAGE_VERSION` and `chartRange` is `'28d'`.
6. Repeat steps 1–5 with `"version":1` and no `theme` key; the theme resolves to `'system'`.

## Case 3 — version 3
1. Seed:
```json
{"version":3,"theme":"light","calendars":[
  {"id":"v3-a","name":"Pushups","color":"#216e39","days":{"2025-03-01":10},"activityValue":-2.5}
]}
```
2. Reload.
3. Verify the activity value reads `-2.5` and the chart shows the day as negative score.
4. Read back `achievement-calendars`: `version` is `STORAGE_VERSION` and `chartRange` is `'28d'`.

## Case 4 — newer version refuses to load
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

## Case 5 — pre-migration snapshot
1. Seed the Case 1 JSON, reload, and record `achievement-calendars-backup`.
2. Verify it equals the Case 1 seed exactly, not the migrated state.
3. Without clearing anything, seed the Case 3 JSON over `achievement-calendars` and reload.
4. Verify `achievement-calendars-backup` now holds the Case 3 seed: one key, overwritten per
   migration, no history kept.
5. Reload once more without changing storage — the state is already at `STORAGE_VERSION`, so
   nothing is migrated and the snapshot is unchanged.
