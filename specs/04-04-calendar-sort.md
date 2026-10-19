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

## Order
Sorting is a view: the stored order of calendars never changes, and Custom shows it.
- **Activities** — each calendar's total count over its visible grid.
- **Score** — that visible total times the calendar's activity value.
- **Recent, most recent first** — by the latest date with a count above zero, over full history;
  ties by `updatedAt`, most recent first. Calendars with no counts at all go last.
- **Recent, least recent first** — calendars with no counts at all come first; then by that
  latest date, oldest first; ties by `updatedAt`, least recent first.
- Every remaining tie, including among calendars with no counts, keeps custom order.

## Reordering
- While any sort other than Custom is selected, each calendar menu's Move up and Move down are
  disabled.
