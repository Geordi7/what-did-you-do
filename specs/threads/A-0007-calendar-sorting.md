---
id: 0007
affects:
  specs: [01-requirements.md, 04-design.md, 03-data-model.md, 03-01-migrations.md, 06-accessibility.md]
  paths: [src/App.tsx, src/store.ts, src/types.ts]
tags: [ui, sorting, calendars, persistence]
links: {}
---
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
