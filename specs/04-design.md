# Design

## Refinements
- `04-01-score-chart.md` — score chart ranges and the range toggle.
- `04-02-copy.md` — title, favicon, subtitle, hint, and the banner region's messages.

## Visual style
- Light, dark, and system themes, selectable from the header. `system` is the default.
- GitHub-like palette for the heatmap in both themes.
- Compact card layout for each calendar.
- Heatmap grid with color intensity based on activity count.
- Clear hover, focus, and today outlines.
- Heatmap zero-activity cell color adapts to the resolved theme (light or dark).
- Each grid carries a Less-to-More legend of five swatches sampled from the calendar color.

## Heatmap intensity curve
- Intensity is relative to each calendar's own maximum count, never a scale shared across calendars.
- The curve is `t = (val / max) ** EXPONENT`, with the exponent a named constant of `0.5`.
- At 50% of max that yields 71% intensity; at 25%, 50%. A value at max is unaffected.
- Zero stays zero: intensity at or below zero renders the zero-activity cell color.

## Theme application
- First paint resolves `system`; the stored choice is applied after state load.
- No boot script and no pre-paint read of the stored preference.
- A user whose stored choice differs from their system setting sees the system theme for one frame.

## Layout
- Header contains title, subtitle, theme selector, create toggle, and import/export icon buttons.
- Banner region sits directly below the header and carries all app notifications.
- Score chart above the calendar cards.
- Collapsible create bar, calendar cards, hint, trash section.
- Calendar card header contains name, total, and a "…" overflow menu.
- Grid and detail panel sit side by side on desktop.
- Grid and detail stack on mobile.
- Detail panel shows the day's date, a "Today" badge, and `count × activityValue = score`;
  with no day highlighted it invites the user to select one.

## Controls
- Header toggle shows and hides the create bar; the bar holds a name input, Create, and Cancel.
- Inline text input for calendar rename.
- The "…" overflow menu holds color picker, activity value, move up, move down, Export, and Delete.
- Trash section offers Recover and Delete forever per item. There is no empty-trash control.
- Delete forever confirms through a native `confirm` dialog, the only such dialog in the app.
- Calendar cells act as buttons.
- Click or tap a cell to add 1. Long-press for 600 ms resets it to 0 and vibrates for 50 ms.
