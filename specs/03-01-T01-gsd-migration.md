# Test Suite: GSD Migration

Manual suite for the version 6 -> 7 and 7 -> 8 steps and the GSD shape in `03-01-migrations.md`. It
continues `03-01-T00-migration.md` and shares its preparation; run that suite's cases first.

The browser tier executes these cases too, in `e2e/migration.e2e.ts` (`05-02-browser-tier.md`).

## Case 9 — version 6 -> 7
1. Seed:
```json
{"version":6,"theme":"light","chartRange":"26w","calendarSort":{"by":"score","dir":"asc"},"calendars":[
  {"id":"v6-a","name":"Runs","color":"#40c463","days":{"2025-06-02":3},"activityValue":1,
   "updatedAt":"2025-06-02T08:00:00.000Z"},
  {"id":"v6-b","name":"Retired","color":"#216e39","days":{},"activityValue":2,
   "updatedAt":"2025-06-01T08:00:00.000Z","deleted":true}
]}
```
2. Reload.
3. Read back `achievement-calendars`: `version` is `STORAGE_VERSION`, `calendarFilter` reads `'all'`,
   and each calendar reads `"kind": "scoring"`.
4. Verify `calendarSort`, `chartRange`, and both calendars are otherwise unchanged, `updatedAt` and
   the trash flag included.
5. Verify `achievement-calendars-backup` holds the seed exactly.

## Case 10 — a GSD calendar at the current version
1. Seed:
```json
{"version":8,"theme":"light","calendarFilter":"gsd","calendars":[
  {"kind":"gsd","id":"v7-g","name":"Chores","color":"#40c463","defaultBounty":2,
   "updatedAt":"2026-10-01T08:00:00.000Z","todos":[
    {"id":"t1","title":"Taxes","bounty":2,"due":"2026-10-08","created":"2026-10-01","children":[
      {"id":"t1a","title":"Find the forms","bounty":0.5,"created":"2026-10-02","done":"2026-10-02",
       "children":[]}]}]}
]}
```
2. Reload: the app loads without a blocking message, and writes no backup (nothing migrated).
3. Read back `achievement-calendars`: the GSD calendar and its todo tree are unchanged.
4. Change the seed so `t1a`'s `done` reads `2026-09-30`, before its `created`, and reload: the
   blocking message appears, its diagnostic names the `validate` phase, and the seed stays intact.

## Case 11 — version 7 -> 8
1. Seed the Case 10 GSD calendar with `"version":7` (with `t1a` done on `2026-10-02`).
2. Reload.
3. Read back `achievement-calendars`: `version` is `STORAGE_VERSION`, and the calendar and its todo
   tree are unchanged; no todo carries `cancelled`.
4. Verify `achievement-calendars-backup` holds the seed exactly.

## Case 12 — a version 7 calendar without a kind
1. Seed Case 9's `Runs` calendar alone, with `"version":7` and `"calendarFilter":"all"`.
2. Reload: the app loads without a blocking message.
3. Read back `achievement-calendars`: `version` is `STORAGE_VERSION`, and `Runs` reads
   `"kind": "scoring"`, otherwise unchanged.
4. Verify `achievement-calendars-backup` holds the seed exactly.
