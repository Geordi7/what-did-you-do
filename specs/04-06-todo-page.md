# Todo Page

Refines `04-design.md`. A GSD calendar's full-page todo tool, at `#/gsd/<id>`; the rules it
applies are in `03-04-gsd-points.md`.

## Navigation
- Opening a GSD calendar from the list sets the hash to `#/gsd/<id>`; Back, or the page's
  "← Calendars" control, returns to the list.
- The page keeps the header and banner region; the score chart, sort bar, create bar, other
  calendars, hint and trash are not shown.
- A hash naming no active GSD calendar shows "That calendar could not be found." with the
  "← Calendars" control.

## Layout
- The calendar's name as the page heading, then its grid and detail panel, as in the list.
- Below the grid, the add row: a title input, a bounty input prefilled with the calendar's
  default bounty, a due date input prefilled one week after today with a control to clear it,
  and Add. Add with an empty title does nothing.
- Then the todo tree: compact rows, Nudges indented under their parent. Siblings run by due date,
  earliest first and undated last, then by creation; done todos sink to the bottom of their
  sibling group, struck through, and cancelled todos sink below them — so cancelled root todos
  sit at the bottom of the page. A cancelled todo is dimmed and italic, with a "Cancelled" note.

## A todo row
- A done checkbox. Ticking marks it done today. While done, its done date shows as a date input
  that can move it to an earlier day, not before its creation and not after today.
- Its title, editable inline like a calendar name.
- Its bounty: an input on a root todo, a fixed "0.5" on a Nudge.
- Its due date, as a date input with a control to clear it; red once passed while still open.
- **Nudge** — adds a child: an inline title input appears under the row; `Enter` adds the Nudge,
  `Escape` or leaving it empty cancels. Not offered on a done todo.
- **Promote** on a Nudge, moving it up one level.
- **Cancel**, which cancels the todo with its Nudges. A cancelled todo shows only **Restore** and
  **Delete**; Delete confirms through a native `confirm` naming the todo and how many Nudges go
  with it. A todo cancelled with its parent shows neither.
- A todo with Nudges has a toggle that collapses and expands them; all start expanded.
- The checkbox is disabled, with the reason in its name, while the todo has an open Nudge, and
  while done under a done parent.

## Day filter
- Clicking a day on the page's grid filters the tree to todos created, finished or due that day,
  each shown with its ancestors for context; a line above the tree names the day with Clear.
- Clicking the same day again, Clear, or any click outside the tree and the grid clears it.
