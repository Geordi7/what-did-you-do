# Score Chart

Combined daily score from all active calendars, shown above the calendar sections.

## Ranges
- **Last 28 days** — one column per day, 28 columns.
- **Last 26 weeks** — one column per Monday-start week, 26 columns, each the sum of its days.
- Every column splits into positive, negative, and net components; the weekly range aggregates
  that same split over the week.
- Default range is last 28 days on first run. The selected range persists.
- A range toggle in the chart header selects the range. The chart carries no total label.
- The chart owns its two spans; the calendar grid's 26-week window is independent of them.
- Aggregation queries only dates in the selected span. All stored history remains available and calendar totals cover full history.

## Marks
- A zero line runs across the middle of the chart; positive values sit above it, negative below.
- The positive and negative totals are filled bars growing from the zero line: green upward for
  the positive total, red downward for the negative one. Bars are at most 8px wide and sit 2px
  left of their column's centre.
- The net is a small diamond centred vertically on its value, 2px right of its column's centre,
  and ringed in the card colour so it stays
  legible over a bar. It is gold when the net equals the positive total (no negatives), otherwise
  green for a positive net and red for a negative one. A zero net draws no diamond.
- Bar height is relative to the largest absolute positive or negative score in the range: that
  value reaches the chart's edge, short only of room for a diamond, and nothing draws outside
  the chart area.
- Hovering or focusing a column shows a tooltip with the date and the positive, negative, and net
  values. It sits wholly below the chart card, horizontally centred on its column, except that it
  shifts inward as far as needed to stay within the card's width. It is as wide as its content
  needs, at most the card's width, wherever its column is.

## Breakdown
- Clicking a column pins its tooltip open and expands it with a breakdown of that day or week:
  one row per active calendar with a non-zero count in it, giving the calendar's name, its total
  count, and its score (count × activity value). Rows run from highest score to lowest; equal
  scores keep calendar order. A column with no
  counts reads "No activity".
- The pinned tooltip stays open when the pointer leaves. Clicking the same column again, pressing
  `Escape`, or clicking anywhere outside the chart columns and the tooltip closes it; clicking
  another column pins that one instead.
- While pinned, the tooltip takes the pointer, so a click on it never reaches what lies beneath.
