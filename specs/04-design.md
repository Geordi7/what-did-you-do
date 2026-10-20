# Design

## Refinements
- `04-01-score-chart.md` — score chart ranges, marks, tooltip, and the click-to-pin breakdown.
- `04-02-copy.md` — title, favicon, subtitle, hint, and the banner region's messages.
- `04-03-dialogs.md` — the import review modal and the unrecoverable-data blocking message.
- `04-04-calendar-sort.md` — the sort bar: Custom, Activities, Score, Recent, and their order.
- `04-05-calendar-grid.md` — grid window (22 weeks back, 4 ahead), month lines, future days,
  intensity curve, cell actions, and the detail panel.
- `04-06-todo-page.md` — a GSD calendar's todo page: navigation, add row, todo rows, day filter.

## Visual style
- Light, dark, and system themes, selectable from the header menu. `system` is the default.
- GitHub-like palette for the heatmap in both themes.
- Each calendar is a flat section, separated from the next by a thin rule and a small margin;
  vertical space is kept to a minimum.
- Heatmap grid with color intensity based on activity count.

## Theme application
- First paint resolves `system`; the stored choice is applied after state load.
- No boot script and no pre-paint read of the stored preference.
- A user whose stored choice differs from their system setting sees the system theme for one frame.

## Layout
- Header contains title, subtitle, and a ☰ menu button: New calendar, Import, Export all, and the
  theme as Light / Dark / System radio items.
- Banner region sits directly below the header and carries all app notifications.
- Score chart, then the sort bar, above the calendar sections.
- Collapsible create bar, calendar sections, hint, trash section.
- Calendar section header is one row: name on the left; total in small dim text and a ⋮
  overflow menu on the right.
- A GSD section is set apart: a ☑ before its name, a "GSD" tag after it, its total as "N done",
  and a left edge in its colour. Clicking anywhere on it but its name and menu, or its Open
  button, opens its todo page.
- Each section holds its grid and a detail panel.

## Controls
- The menu's New calendar opens the create bar; the bar holds a name input, a kind choice
  (Scoring, the default, or Getting Stuff Done), Create, and Cancel.
- Inline text input for calendar rename.
- The ⋮ overflow menu holds color picker, activity value (default bounty on a GSD calendar), move
  up, move down, Export, and Delete.
- Trash section offers Recover and Delete forever per item. There is no empty-trash control.
- Delete forever confirms through a native `confirm` dialog, the app's only native dialog.
