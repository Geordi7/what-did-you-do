# Import and Export

Refines `03-data-model.md`.

## Envelope

```ts
interface ExportEnvelope {
  version: number;      // STORAGE_VERSION at export time
  exportedAt: string;   // ISO timestamp
  calendars: Calendar[];
}
```

- The payload is plain JSON. It is never base64-encoded.
- Export-all covers every calendar, trashed ones included — a backup is complete.
- A full export records its timestamp under `achievement-calendars-last-export`.
- Each calendar carries its own `updatedAt`, being part of `Calendar`.

## Accepted input

An import accepts any of:

- an envelope — migrations run from the envelope's own `version`;
- a bare array of calendars — treated as version 3;
- a single calendar object — treated as version 3.

A legacy shape is wrapped as `{ version: 3, calendars: [...] }` before migrations run.
The version marker is read before that wrapping, so a payload declaring a version newer than the
current one is refused whatever its shape — wrapping it first would hide the marker. A migration
step parses a versioned envelope, never a bare array or a lone calendar.

## Rules

- An oversized payload is rejected before it is parsed. `07-security-standard.md` owns the cap.
- Imported data is untrusted: it is migrated and then parsed with the current-version schema before anything is stored, the same path a load takes.

## Review

Every import opens a review modal, and that modal is the import surface: nothing is written until the
user applies it.

- The modal lists **every** calendar in the payload, colliding or not, one row each.
- A row shows the calendar's name, its number of events, and its last update.
- Number of events is the sum of all its day counts — the same number a calendar card shows.
- Last update is the calendar's `updatedAt` as it arrives in the payload.
- A row whose `id` collides with a live calendar also carries a dropdown of merge actions.
- Any row can be rejected, colliding or not. A rejected row is not imported.
- Apply commits every row's disposition as a single write. Cancel abandons the whole import,
  appends included, as one write that never happened.
- The outcome reports on the inline import status line after Apply, never inside the modal.
- The modal's shape is in `04-03-dialogs.md`, its wording in `04-02-copy.md`, and its focus trap,
  Escape, and focus return in `06-accessibility.md`.

## Matching

Every calendar in the payload is matched by `id` against the ids already in the store.

- No match — the row is **accepted** by default and, on Apply, appends to the end of the array,
  undeleted, whatever the source said. Rejecting it imports nothing.
- Match — the row is **rejected** by default, so the safe outcome needs no interaction. Choosing a
  merge action from its dropdown un-rejects the row.

## Collision resolution

A colliding row that is not rejected merges under one of four actions.

| Action | Days | Name, color, activityValue |
|--------|------|----------------------------|
| `replace` | the imported calendar's `days` wholly supersede the live ones | import wins |
| `merge-by-sum` | union of dates; a date present in both holds the sum of its two counts | live wins |
| `merge-prefer-import` | union of dates; a date present in both takes the imported count | import wins |
| `merge-prefer-live` | union of dates; a date present in both keeps the live count | live wins |

- A merged calendar keeps the live calendar's `id`, its index in the array, and its `deleted`
  flag; merging never reorders, appends, or moves a calendar into or out of trash.
- `merge-by-sum` keeps the live metadata: summing is about history, and renaming a calendar the
  user already has would be a surprise.
- A merge that changes a calendar stamps its `updatedAt`.
- The four actions are pure functions of the live calendar and the imported one, independently
  testable without the store.

### Rejected rows

A rejected colliding row leaves the live calendar **wholly** untouched: its days, metadata,
`deleted` flag, index, and `updatedAt` all stand as they were. Nothing is imported for that row and
no new calendar appears under a new id.

One outcome gets one control, so rejection lives in whichever control the row already has: a
colliding row is rejected through its dropdown, whose FIRST option skips the row and is the option
it starts on, and a non-colliding row through its skip checkbox. `04-03-dialogs.md` owns the two
widgets, `06-accessibility.md` the option order.
