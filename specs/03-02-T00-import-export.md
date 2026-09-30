# Test Suite: Import and Export

Manual suite for `03-02-import-export.md`. Run the cases in order.

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

## Collision fixture
Cases 4–9 all start from the same two states. Rebuild both before each case.

- **Live**: an app holding only `😱 Wins`, color default, activity value `1.0`,
  `2025-05-01` = 3 and `2025-05-02` = 1. Note its `id` from `achievement-calendars`.
- **Payload**: a hand-written envelope holding one calendar that reuses that exact `id`, named
  `Imported Wins`, color `#216e39`, activity value `2.0`, `updatedAt` `2025-06-01T12:00:00.000Z`,
  `2025-05-02` = 5 and `2025-05-03` = 2.

## Case 4 — colliding row merged as `replace`
1. Import the payload. Verify the modal shows one row for `Imported Wins`, that the row starts
   **rejected**, and that its dropdown offers exactly `replace`, `merge-by-sum`,
   `merge-prefer-import`, and `merge-prefer-live` — no keep-the-live-calendar action.
2. Choose `replace` from the dropdown. Verify the row is no longer rejected.
3. Apply.
4. Verify exactly one calendar exists, still at index 0, still under the live `id`.
5. Verify its days are `2025-05-02` = 5 and `2025-05-03` = 2 only — `2025-05-01` is gone.
6. Verify its name is `Imported Wins`, color `#216e39`, activity value `2.0`.
7. Verify its `updatedAt` advanced: a merge that changes a calendar stamps it.

## Case 5 — colliding row merged as `merge-by-sum`
1. Import the payload, choose `merge-by-sum`, and Apply.
2. Verify one calendar under the live `id` with days `2025-05-01` = 3, `2025-05-02` = 6,
   `2025-05-03` = 2.
3. Verify the name is still `😱 Wins`, the color still default, the activity value still `1.0`:
   summing keeps the live metadata.
4. Verify `updatedAt` advanced.

## Case 6 — colliding row merged as `merge-prefer-import`
1. Import the payload, choose `merge-prefer-import`, and Apply.
2. Verify days `2025-05-01` = 3, `2025-05-02` = 5, `2025-05-03` = 2.
3. Verify name `Imported Wins`, color `#216e39`, activity value `2.0`, and `updatedAt` advanced.

## Case 7 — colliding row merged as `merge-prefer-live`
1. Import the payload, choose `merge-prefer-live`, and Apply.
2. Verify days `2025-05-01` = 3, `2025-05-02` = 1, `2025-05-03` = 2.
3. Verify name `😱 Wins`, color default, activity value `1.0`, and `updatedAt` advanced.

## Case 8 — colliding row left at its rejected default
1. Note the live calendar's `updatedAt` before importing.
2. Import the payload. Touch nothing: leave the row at its rejected default.
3. Apply.
4. Verify the calendar is byte-for-byte what it was: days `2025-05-01` = 3, `2025-05-02` = 1,
   name `😱 Wins`, color default, activity value `1.0`, `updatedAt` unchanged.
5. Verify no second calendar was added and no new id appears.

## Case 9 — row columns
1. Import the payload. Verify the row names the imported calendar `Imported Wins`.
2. Verify its event count reads `7` — the sum of all day counts, `5` plus `2`, the same number its
   card would show.
3. Verify its last-update column reflects the payload's `updatedAt` of `2025-06-01`.
4. Cancel, then import a payload whose calendar has no counted days: the row reads `0` events.

## Case 10 — rejecting a non-colliding row
1. Start from an app holding only `😱 Wins`.
2. Hand-write an envelope holding two calendars, both with ids matching nothing: `Keeper` and
   `Unwanted`.
3. Import it. Verify both rows are accepted by default and neither carries a merge dropdown.
4. Reject `Unwanted`, leave `Keeper` accepted, and Apply. Verify `Keeper` was appended and
   `Unwanted` is absent — not in the list, not in trash, not under any id in storage.

## Case 11 — appended calendars land undeleted
1. Hand-write an envelope whose single calendar carries `"deleted":true` and an id matching nothing.
2. Import it, leave the row accepted, Apply, and verify it appears among the active calendars while
   the trash section does not list it.

## Case 12 — mixed payload
1. Start from an app holding `😱 Wins`, `Skipped`, and `Retired`. Note all three ids and their
   `updatedAt` values.
2. Hand-write an envelope holding four calendars: three reusing those exact ids with different
   names, colors, and counts, plus one with an id that matches nothing.
3. Import it.
4. Verify the modal lists all four rows, that the three colliding rows start rejected and carry
   dropdowns, and that the fourth starts accepted and carries none.
5. Choose `replace` for `😱 Wins` and `merge-by-sum` for `Skipped`. Leave `Retired` rejected, Apply.
6. Verify `😱 Wins` and `Skipped` resolved exactly as their own cases above specify, each under its
   live id and original index.
7. Verify `Retired` is byte-for-byte unchanged, `updatedAt` included, and still in the trash.
8. Verify the non-colliding calendar was appended at the end of the array, active.

## Case 13 — import failures report inline
1. Import a file containing malformed JSON.
2. Verify the failure reports on the status line in the banner region below the header, with no
   native dialog and no modal, and that no calendar was added.
3. Verify the failure status stays until it is dismissed or a later import supersedes it.
4. Import a valid file, Apply, and verify the success status replaces it there, then clears itself
   after about 5 seconds.

## Case 14 — cancelling an import writes nothing
1. With the three fixtures in place, import the Case 12 four-calendar envelope.
2. Choose merge actions for two of the three colliding rows and reject the non-colliding one.
3. Cancel the modal.
4. Verify the three live calendars are byte-for-byte unchanged: names, colors, activity values, day
   counts, `updatedAt` values, order, and `Retired` still in trash.
5. Verify the non-colliding calendar was **not** appended: Cancel abandons the whole import, merges
   and appends alike, as one write that never happened.
6. Repeat with `Escape` instead of Cancel, and verify the same outcome.
