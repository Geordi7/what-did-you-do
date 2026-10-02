# Test Suite: Import and Export

Manual suite for `03-02-import-export.md`, run in order; `e2e/import-export.e2e.ts` executes these
cases too. Collision and disposition cases live in `03-02-T01-collisions.md` and continue this
file's case numbering, so a case number means one thing across both.

## Preparation
Build this fixture set by hand in the app, then keep it for every case:

- `😱 Wins` — color left at default, activity value `1.0`, two days counted.
- `Skipped` — activity value `-2.5`, one day counted.
- `Retired` — any counts, then soft-deleted so it sits in trash.

Keep devtools open on Application → Local Storage for the app origin.

Every import opens the review modal, so each case below reaches the store only via Apply.

## Case 1 — round-trip
1. Export all calendars from the header.
2. Open the file in a text editor. Verify it is readable JSON, not base64, and carries
   `version`, `exportedAt`, and `calendars`.
3. Verify `calendars` holds all three fixtures, `Retired` included.
4. Verify `achievement-calendars-last-export` now holds the export timestamp, and the backup
   banner is gone.
5. Delete every `achievement-calendars*` key and reload. The app is empty.
6. Import the file. Verify the modal lists all three calendars, each accepted and carrying no merge
   dropdown — nothing collides in an empty store.
7. Apply. Verify all three return with their names, colors, counts, and activity values.
8. Verify `Retired` comes back as an active calendar, not in trash: all three are appends, and an
   appended calendar lands undeleted.

## Case 2 — round-trip with emoji names and negative activity values
1. With the fixtures in place, export all calendars. Verify no error and no native dialog.
2. Verify the file contains the name `😱 Wins` intact, and records `Skipped` with
   `"activityValue":-2.5`.
3. Import the file into an empty app and Apply.
4. Verify `😱 Wins` renders identically, emoji included, in the modal row and on its card.
5. Verify the activity-value input for `Skipped` reads `-2.5`, unchanged in sign and precision.
6. Verify the score chart shows `Skipped`'s day in the negative split, and the net bar reflects it
   against `😱 Wins`.

## Case 3 — legacy bare-array export
1. Hand-write a file holding a bare array of version-3 calendars — no envelope, no `version`:
```json
[
  {"id":"legacy-a","name":"Walks","color":"#40c463","days":{"2025-05-02":4},"activityValue":1},
  {"id":"legacy-b","name":"Naps","color":"#216e39","days":{"2025-05-03":1},"activityValue":0.5}
]
```
2. Import it into an empty app. Verify the modal lists both calendars, then Apply.
3. Verify both calendars appear, active, with their counts and activity values.
4. Read back `achievement-calendars` and verify `version` is `STORAGE_VERSION`.
5. Repeat with a file holding a single calendar object rather than an array: one calendar is added.

## Case 13 — import failures report inline
1. Import a file containing malformed JSON.
2. Verify the failure reports on the status line in the banner region below the header, with no
   native dialog and no modal, and that no calendar was added.
3. Verify the failure status stays until it is dismissed or a later import supersedes it.
4. Import a valid file, Apply, and verify the success status replaces it there, then clears itself
   after about 5 seconds.
