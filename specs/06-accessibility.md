# Accessibility

Every flow is reachable by keyboard alone, in both themes.

## Calendar cells
- Cells are buttons and take focus in chronological order: down each week column, then
  left to right across the columns.
- `Enter` or `Space` increments the focused day's count.
- `Backspace` or `Delete` clears the focused day's count.
- Focus is visible on every cell, distinct from hover and from the today outline.

## Overflow menu
- The "…" trigger carries `aria-haspopup="menu"` and `aria-expanded` reflecting open state.
- The popup carries `role="menu"`; each control inside it is a `role="menuitem"` (or the
  matching `menuitemcheckbox` / `menuitemradio` where the control has a state).
- `ArrowDown` / `ArrowUp` move focus between items and wrap at the ends.
- `Home` / `End` move to the first and last item.
- `Escape` closes the menu, as does a click outside it.
- Opening the menu moves focus into it; closing it returns focus to the trigger, however
  it was closed.

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
