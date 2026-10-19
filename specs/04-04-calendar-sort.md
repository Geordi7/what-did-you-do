# Calendar Sort

Refines `04-design.md`. A sort bar sits between the score chart and the calendar sections.

## Controls
- Four buttons in one row, in this order: **Custom**, **Activities**, **Score**, **Recent**.
- Exactly one is selected, shown pressed. Custom is selected on first run.
- Clicking an unselected sort button selects it, high to low (most recent first for Recent).
  Clicking the selected one flips its direction. Clicking Custom selects custom order.
- The selected sort button shows its direction as ▼ (high to low, most recent first) or ▲ (low
  to high, least recent first).
- The selected sort persists across reloads.

## Filter
- After the sort buttons, a filter of three buttons: **All**, **Scoring**, **GSD**. Exactly one is
  selected, All on first run. Scoring and GSD show only calendars of that kind.
- The filter persists across reloads, and applies on top of the sort.

## Order
Sorting is a view: the stored order of calendars never changes, and Custom shows it.
- **Activities** — each calendar's total activity count over its visible grid (for a GSD calendar,
  root todos done).
- **Score** — each calendar's total score over its visible grid: counts times activity value, or a
  GSD calendar's points.
- **Recent, most recent first** — by the latest date with recorded activity, over full history: a
  count above zero, or any GSD points. Ties by `updatedAt`, most recent first. Calendars with no
  activity at all go last.
- **Recent, least recent first** — calendars with no activity at all come first; then by that
  latest date, oldest first; ties by `updatedAt`, least recent first.
- Every remaining tie, including among calendars with no counts, keeps custom order.

## Reordering
- While any sort other than Custom, or any filter other than All, is selected, each calendar
  menu's Move up and Move down are disabled.
