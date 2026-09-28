# Score Chart

Combined daily score from all active calendars, shown above the calendar cards.

## Ranges
- **Last 28 days** — one bar per day, 28 bars.
- **Last 26 weeks** — one bar per Monday-start week, 26 bars, each the sum of its days.
- Every bar splits into positive, negative, and net components; the weekly range aggregates
  that same split over the week.
- Default range is last 28 days on first run. The selected range persists.
- A range toggle in the chart header selects the range. The chart carries no total label.
- The chart owns its two spans; the calendar grid's 26-week window is independent of them.

## Bars
- Bar height is relative to the largest absolute positive or negative score in the range.
- Hovering or focusing a bar shows a tooltip with the date and the positive, negative, and net values.
