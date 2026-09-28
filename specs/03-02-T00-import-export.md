# Test Suite: Import and Export

Manual suite for `03-02-import-export.md`. Run the cases in order.

## Preparation
Build this fixture set by hand in the app, then keep it for every case:

- `😱 Wins` — color left at default, activity value `1.0`, two days counted.
- `Skipped` — activity value `-2.5`, one day counted.
- `Retired` — any counts, then soft-deleted so it sits in trash.

Keep devtools open on Application → Local Storage for the app origin.

## Case 1 — round-trip
1. Export all calendars from the header.
2. Open the file in a text editor. Verify it is readable JSON, not base64, and carries
   `version`, `exportedAt`, and `calendars`.
3. Verify `calendars` holds all three fixtures, `Retired` included.
4. Verify `achievement-calendars-last-export` now holds the export timestamp, and the backup
   banner is gone.
5. Delete every `achievement-calendars*` key and reload. The app is empty.
6. Import the file.
7. Verify all three calendars return with their names, colors, counts, and activity values.
8. Verify `Retired` comes back as an active calendar, not in trash: imports always land undeleted.

## Case 2 — emoji names
1. With the fixtures in place, export all calendars.
2. Verify the export completes with no error and no native dialog.
3. Verify the file contains the name `😱 Wins` intact.
4. Import the file into an empty app and verify the name renders identically, emoji included.

## Case 3 — negative activity values
1. Verify the export file records `Skipped` with `"activityValue":-2.5`.
2. Import it into an empty app.
3. Verify the activity-value input reads `-2.5`, unchanged in sign and precision.
4. Verify the score chart shows that calendar's day in the negative split, and the net bar reflects
   it against `😱 Wins`.

## Case 4 — legacy bare-array export
1. Hand-write a file holding a bare array of version-3 calendars — no envelope, no `version`:
```json
[
  {"id":"legacy-a","name":"Walks","color":"#40c463","days":{"2025-05-02":4},"activityValue":1},
  {"id":"legacy-b","name":"Naps","color":"#216e39","days":{"2025-05-03":1},"activityValue":0.5}
]
```
2. Import it into an empty app.
3. Verify both calendars appear, active, with their counts and activity values.
4. Read back `achievement-calendars` and verify `version` is `STORAGE_VERSION`.
5. Repeat with a file holding a single calendar object rather than an array, and verify that one
   calendar is added.

## Case 5 — id collision
1. Start from an app holding only `😱 Wins`. Note its `id` from `achievement-calendars`.
2. Hand-write an envelope whose single calendar reuses that exact `id` but differs in name, color,
   and counts.
3. Import it.
4. Verify two calendars now exist: the original `😱 Wins` untouched in name, color, and counts, plus
   the imported one under a fresh id.
5. Verify the two ids differ and neither is empty.

## Case 6 — imports land undeleted
1. Hand-write an envelope whose single calendar carries `"deleted":true`.
2. Import it.
3. Verify it appears among the active calendars and the trash section does not list it.

## Case 7 — import failures report inline
1. Import a file containing malformed JSON.
2. Verify the failure reports on the status line in the banner region below the header, with no
   native dialog, and that no calendar was added.
3. Verify the failure status stays until it is dismissed or a later import supersedes it.
4. Import a valid file and verify the success status replaces it, then clears itself after about
   5 seconds.
