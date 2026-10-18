# Dialogs

Modal surfaces and their behaviour. Copy lives in `04-02-copy.md`; focus trap, Escape, focus
return, and the keyboard and screen-reader behaviour of the row controls live in
`06-accessibility.md`.

Only two surfaces are modal. Everything else notifies through the banner region, and
delete-forever still asks through a native `confirm`.

## Import review modal

The import surface itself. Every import opens it, whether or not any id in the payload matches
a live calendar, because rejecting a calendar must be possible in both cases.

### Rows
- One row per calendar in the payload, in payload order. Nothing is filtered out.
- Each row shows the calendar's name, its number of events, and its last update.
- Number of events is the sum of that calendar's day counts — the same total its section shows.
- Last update is the calendar's stored `updatedAt` timestamp, carried in the payload.
- A row whose id matches a live calendar is a colliding row and also carries a merge-action
  dropdown whose first option skips the row, followed by `replace`, `merge-by-sum`,
  `merge-prefer-import`, and `merge-prefer-live`.
  Their day-level and metadata meaning lives in `03-02-import-export.md`.
- A non-colliding row has no dropdown; importing it appends it to the end of the array, undeleted.

### Skip and accept
Each row carries exactly one control, so a row's disposition is never split across two widgets that
have to agree with each other.

- A calendar with no live counterpart carries a skip checkbox. Unchecked it is imported; checked it
  is not. It starts unchecked.
- A calendar that already exists carries the merge dropdown instead, and that dropdown **is** its
  disposition. Its first option skips the row, and that is the option the row starts on. The four
  merge actions follow.
- A skipped row is not imported at all. A skipped colliding row leaves the live calendar untouched:
  same id, same index, same trash state, same timestamp.
- Skipped and accepted rows are distinct at a glance, not only by the state of a control: a skipped
  row is dimmed and its name struck through.
- No control is ever disabled, so any row's disposition can be changed at any point before Apply.
- Rows are decided independently; a disposition on one calendar constrains no other.

### Outcome
- A long list of rows scrolls inside the modal; the title and the action buttons stay in view.
- Apply and Cancel are the only outcomes, and `Escape` is a Cancel. Nothing is written until Apply.
- Apply commits every row's disposition — merges, appends, and rejections — as one write.
- Cancel abandons the whole import, appends included.
- With every row skipped, Apply is still available and changes nothing.
- A payload holding no calendars has nothing to review: the list is replaced by a line saying so,
  and Cancel is the only action offered.
- The outcome reports afterwards on the inline import status line, not inside the modal.
- A merge never moves a calendar into or out of trash.

## Unrecoverable data message
- Shown on load when stored data fails to migrate or fails validation.
- Blocking: it covers the app and has no dismiss, because the state behind it is a defect rather
  than something the user can act on. The storage error banner is the opposite case — the app stays
  usable behind it.
- The app runs in memory from empty state while it is shown. The stored string and the
  pre-migration backup are left byte-intact; nothing is written.
- Offers the structured diagnostic two ways: copy it to the clipboard, or download it as a file.
- Both carry the same payload. Its shape lives in `03-01-migrations.md`.
- A failed load also offers Download saved data, containing the original raw JSON for recovery. It explains preserving a copy, repairing dates, then clearing the invalid local state and importing the repaired file.
