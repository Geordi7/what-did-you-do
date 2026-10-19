# Accessibility

Every flow is reachable by keyboard alone, in both themes.

## Calendar cells
- Cells are buttons and take focus in chronological order: down each week column, then
  left to right across the columns.
- `Enter` or `Space` increments the focused day's count.
- `Backspace` or `Delete` clears the focused day's count.
- Focus is visible on every cell, distinct from hover and from the today outline.

## Score chart
- Each chart column is a button with `aria-expanded` reflecting whether its breakdown is pinned.
- `Enter` or `Space` on a focused column toggles its breakdown; `Escape` closes it and leaves
  focus on the column.
- The column's accessible name carries its date and values; a pinned breakdown is referenced from
  the column with `aria-describedby`.

## Menus
The header's ☰ menu and each calendar's ⋮ overflow menu behave alike.
- The trigger carries `aria-haspopup="menu"` and `aria-expanded` reflecting open state.
- The popup carries `role="menu"`; each control inside it is a `role="menuitem"` (or the
  matching `menuitemcheckbox` / `menuitemradio` where the control has a state). The theme items
  are `menuitemradio`, with `aria-checked` marking the current theme.
- `ArrowDown` / `ArrowUp` move focus between items and wrap at the ends.
- `Home` / `End` move to the first and last item.
- `Escape` closes the menu, as does a click outside it.
- Opening the menu moves focus into it; closing it returns focus to the trigger, however
  it was closed.
- Calendar name, color, and activity-value inputs have explicit accessible names identifying the calendar.

## Modal surfaces
Two surfaces take over the page: the import review modal, where the user decides what each
calendar in the payload does, and the blocking message shown when stored data fails to migrate
or validate.

Common behaviour:
- The container carries `role="dialog"` and `aria-modal="true"`, and is labelled by its own
  heading through `aria-labelledby`. Where a line of body text is what explains the choice,
  it is referenced with `aria-describedby`.
- Opening moves focus into the dialog — to the first interactive control, or to the heading
  when the first control is far down the content.
- Focus is trapped while open: `Tab` and `Shift+Tab` cycle within the dialog and never reach
  the calendar, the overflow menu, or anything else behind it.
- Content behind the dialog is inert to the screen reader as well as to the pointer, so the
  grid is not readable while a dialog is up.
- Native inert is supplemented by a focus guard for the browser baseline. A dialog without controls retains focus on its panel for both Tab directions.
- Closing returns focus to the element that opened the dialog, however it was closed.

### Import review modal
- `Escape` is a Cancel: nothing is written, and focus returns to the header's ☰ menu button, from
  which the import started.
- Opening moves focus to the first row's own control, so the first thing read is a row and not the
  surrounding chrome.

Rows:
- The rows are one `role="list"` whose accessible name states how many calendars the payload holds.
- Each row is a `role="listitem"`, so the list's count and its row-by-row navigation are exposed.
  Its accessible name carries, in this order, the calendar's name, its number of events, its last
  update, and whether the id matches a live calendar — a screen-reader user has no column headers in
  view, so the row must be self-describing.
- Each row has exactly one control, and that control is where the row's disposition is announced: a
  skip checkbox on a calendar with no live counterpart, the merge dropdown on one that already
  exists. Its accessible name names the calendar it acts on, so it is unambiguous out of visual
  context.
- `Tab` reaches the rows in payload order, one control per row. No control is disabled, so every
  row's disposition stays reachable whatever it currently is.

Merge dropdown:
- It is a collapsed listbox: `aria-expanded` reflects open state, and its accessible name carries
  both its visible label and its row, so the calendar is read before the actions.
- Its options are the skip option first, then `replace`, `merge-by-sum`, `merge-prefer-import` and
  `merge-prefer-live`. Each option's accessible name states what happens to the days, not only its
  short label.
- `ArrowDown` / `ArrowUp` move between options; `Home` / `End` reach the first and last; `Enter` or
  `Space` commits the focused option and closes the list.
- Each action's accessible name states what happens to the days, not just the action's short name.
- `Escape` closes an open list and leaves the row's disposition as it was. It reaches the modal only
  when no list is open, so dismissing the dropdown never cancels the import.

Actions:
- Apply and Cancel are the last stops in the cycle and are reachable by keyboard from any row.

### Blocking message
- It carries `role="alertdialog"` so it is announced on arrival, and focus moves into it.
- `Escape` does nothing: there is no safe state to dismiss to while the stored data cannot be
  read, and the trap holds for the life of the page.
- Both diagnostic controls — Copy diagnostic and Download diagnostic — are focusable and named
  for what they produce. Copy diagnostic is the surface's first interactive stop, Download
  diagnostic the second.
- Download saved data is the third stop when raw recovery data is available; all stops participate in the same focus cycle.

## Contrast
- The light theme meets WCAG 2.2 AA against its own backgrounds: 4.5:1 for body text and muted
  labels, 3:1 for heatmap cell borders and control outlines.
- Heatmap intensity steps stay distinguishable from the zero-activity cell in both themes.
- Color is never the only carrier of meaning: counts and scores are also available as text
  in the detail panel and in cell labels.

## Motion
- Under `prefers-reduced-motion: reduce`, transitions and animations are removed or reduced
  to an instant state change.
- No flow depends on an animation completing.

## Announcements
- A polite live region announces a day's new count when it changes, so an increment or a
  clear is audible without moving focus.
- The region announces the changed value only; it does not re-read the surrounding grid.
- The same region announces an import outcome after the review modal closes, since the result
  appears on the status line once focus has already returned to the menu button.
- The latest event supplies the announcement, including day changes while an import outcome is still visible.
