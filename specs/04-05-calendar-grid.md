# Calendar Grid

Each calendar section's heatmap grid and its day detail panel.

## Window
- Every grid shows 26 Monday-start week columns: 22 ending with the current week, then 4 ahead.
  All grids share this window, so their columns line up.
- Month labels sit above the first column of each month; a leading month with fewer than three
  columns gives way to the next month's label.
- A thin stepped line in the gaps between cells separates each month from the last. Cell colours
  are unaffected, and nothing shades the background behind the cells.
- Days after today are future days: darkened and hatched over their cell colour, so they stand
  apart from past days in both themes, and never changed by a click, tap, long-press or key.

## Heatmap intensity curve
- Intensity is relative to each calendar's maximum count over its visible grid, with a minimum
  scale of one; dates outside that window do not affect intensity.
- The curve is `t = (val / max) ** EXPONENT`, with the exponent a named constant of `0.5`.
- At 50% of max that yields 71% intensity; at 25%, 50%. A value at max is unaffected.
- Zero stays zero: intensity at or below zero renders the zero-activity cell color, which adapts
  to the resolved theme.

## Cells
- Calendar cells act as buttons, with clear hover, focus, and today outlines.
- Saturdays and Sundays are slightly lighter than weekdays, over their cell colour, past and
  future alike.
- Scoring calendar: click or tap a day to add 1. Long-press for 600 ms resets it to 0 and vibrates
  for 50 ms.
- GSD calendar: a day's colour follows its todos done, Nudges included. Its cells never change
  anything in the list: a click, tap or `Enter` opens the calendar's todo page; on that page it
  sets the day filter (`04-06-todo-page.md`). Future days are hatched but still respond.
- A GSD day with open todos due shows a thick dot in its centre in the foreground colour, red once
  the day is before today; no dot once every todo due that day is done.

## Detail panel
- Grid and detail panel sit side by side on desktop; they stack on mobile, the detail's date,
  badge and score on one line.
- The panel is unboxed text, vertically centred on the grid's cells.
- It shows the highlighted day's date, a "Today" badge, and `count × activityValue = score`;
  on a GSD calendar, `Created N · Finished M · Due K · +P points`. With no day highlighted it
  invites the user to select one.
