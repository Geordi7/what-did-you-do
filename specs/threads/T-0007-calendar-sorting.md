---
id: 0007
affects:
  specs: [01-requirements.md, 04-design.md, 03-data-model.md, 03-01-migrations.md, 06-accessibility.md]
  paths: [src/App.tsx, src/store.ts, src/types.ts]
tags: [ui, sorting, calendars, persistence]
links: {}
---
## Outcome
Decision: a sort bar above the calendar sections holds, in order, [Custom] [Activities ▲/▼]
[Score ▲/▼] [Recent ▲/▼]. Clicking a sort button selects it; clicking the selected one flips its
direction; the arrow shows the direction. Sorting is a view: the stored order is never rewritten,
and Custom shows it. While any sort other than Custom is active, Move up and Move down are shown
disabled. The chosen sort persists across reloads in stored state (storage version 6).
- Activities and Score are totals over each calendar's visible 26-week grid, not full history.
- Recent, most recent first: by the latest date with a count above zero (full history); ties by
  `updatedAt`, most recent first; calendars with no counts at all go last, in custom order.
- Recent, least recent first: calendars with no counts at all come first, in custom order; then
  by the latest date with a count, oldest first; ties by `updatedAt`, least recent first.
- Every other tie keeps custom order.
- Getting Stuff Done calendars sort by their own activities, points and dates (thread 0008).
Rejected:
1. Sorting by rewriting the stored order: Custom could not be returned to.
2. Hiding Move up / Move down while sorted: the operator chose disabled, so the menu keeps its shape.
3. Full-history totals for Activities and Score: the sort follows what the grid shows.
4. Recency by last edit (`updatedAt`) alone: recency means recorded activity; edits only break ties.
5. Seven separate sort buttons: they do not fit a phone.
6. A session-only sort: the choice persists like the chart range.
Reopen if: calendars gain a view where the visible window differs from 26 weeks.

## Thread
> Operator asked in chat: add sorting buttons to the top of the calendar area — total (visible)
> activities asc/desc, total score asc/desc, most recently active, least recently active, and
> ideally "return to custom sort order". How should sorting work?
>
> Q1. Sort is a view only: it never rewrites the stored order, and "Custom order" shows the
> stored order again. Move up / Move down appear only while Custom order is active (they would
> do nothing visible otherwise). Proposed: yes.
> Q2. "Visible" means the 26-week grid each calendar shows, for both activities and score —
> not full history (the header total today covers full history). Proposed: visible 26 weeks.
> Q3. "Recently active" means the latest date with a count above zero, not when the calendar
> was last edited. Calendars with no activity at all go last in both directions. Ties in any
> sort keep custom order. Proposed: yes.
> Q4. The chosen sort persists across reloads, like the chart range. That adds a field to stored
> state (storage version 6). Proposed: yes.
> Q5. Controls: four buttons in one row above the calendars —
>   [Activities ▲/▼] [Score ▲/▼] [Recent ▲/▼] [Custom]
> Clicking a sort button selects it; clicking it again flips direction; the arrow shows the
> direction. Seven separate buttons would not fit a phone. Proposed: this row.
> Q6. How a Getting Stuff Done calendar sorts is part of thread 0008 (proposed: by its points
> and its days with points, like any scoring calendar).

Q1: disable move up/move down while sorting is acive.
Q2: Agree
Q3:
- most recently active: measure by the last date an activity was recorded, tie-break by edited timestamp
- least recently active: as above, calendars with zero entries come first, tie-break zero entry calendars by custom order
Q4: agree
Q5: agree, put custom first
Q6: sure

decided

> Recorded in the Outcome. One reading to flag: for least recently active, I read "tie-break by
> edited timestamp" as least recently edited first (mirroring most recent). Say if you meant
> otherwise. Decided in thread; renamed A → R. Applying now.

> Applied: sort bar and `calendarSort` (storage version 6, with its migration step and suite case
> 8); specs 01, 03, 03-01, 04, the new 04-04 refinement, 06 and the browser tier updated. Getting
> Stuff Done sorting waits on thread 0008. Renamed R → T.
