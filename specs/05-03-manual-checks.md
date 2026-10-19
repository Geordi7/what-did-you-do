# Manual Checks

Human procedures. Everything here is either a judgement a script cannot make — whether a thing
*looks* right — or a flow cheap enough to walk. Cases the browser tier now executes
(`05-02-browser-tier.md`) stay listed: automation removed them from every-change work, not from a
tester's reach.

- Add new calendar.
- Rename calendar.
- Change calendar color.
- Set a calendar's activity value, including a negative one.
- Move calendar up and down.
- Click day to increment count.
- Long-press day to reset count.
- Use keyboard Enter, Space, Backspace, Delete on focused cell.
- Delete calendar, then recover it, and confirm it returns to its original position.
- Delete forever on a single trashed calendar, through its confirmation.
- `updatedAt` stamping: a count change, rename, colour change, activity-value change, soft delete,
  recover, and an applied merge each advance that calendar's last-update reading. The stamping
  itself is asserted in `05-01-automated-tier.md`; what stays here is that it READS correctly in
  the import modal's last-update column, which is the only place a user sees it.
- Export all calendars to a file, then import that file back.
- Import review modal: every calendar in the payload gets a row, colliding or not, and the event
  sum and last-update columns match what each calendar section shows.
- Import review modal by keyboard alone: focus enters on the first row's control, Tab reaches one
  control per row in payload order with none disabled, the dropdown opens and commits with the
  keyboard, focus is trapped while open, and Escape cancels and returns focus to the header menu button.
- A payload holding no calendars offers only Cancel, with a line saying the file holds none.
- Exercise each of the four merge actions on a colliding row, confirming the outcome reports
  afterwards on the inline import status line rather than inside the modal.
- Leave a colliding row at its rejected default, Apply, and confirm that live calendar is unchanged.
- Reject a non-colliding row, Apply, and confirm it is not added while the remaining rows land.
- Cancel the modal and confirm nothing was written, appends included.
- Reload page and confirm state persists.
- Toggle theme light/dark/system and confirm heatmap zero cells adapt.
- Reload after theme change and confirm preference persists.
- Switch the chart range between 28 days and 26 weeks, then reload and confirm the choice persists.
- Hover a date in one calendar and confirm the same date highlights in every calendar.
- Backup banner: with a last export 24 or more hours old it appears on load; exporting now hides it;
  dismissing hides it for the rest of the session.
- Midnight rollover: with the app left open across midnight, the today marker and the chart's
  trailing window both advance without a reload.
- Cross-tab sync: with two tabs open on the same device, a count change, a theme change, and an
  export in one tab all land in the other; clearing storage in one tab leaves the other's in-memory
  state standing.
- Responsive: narrow the viewport and confirm the detail panel stacks below the grid with no
  sideways scrolling.

