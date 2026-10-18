---
id: 0008
affects:
  specs: [01-requirements.md, 03-data-model.md, 03-01-migrations.md, 03-02-import-export.md, 04-01-score-chart.md]
  paths: [src/types.ts, src/scores.ts, src/schemas.ts, src/migrations.ts, src/store.ts]
tags: [gsd, todo, scoring, data-model, migration]
links: {related: [0009, 0007]}
---
## Thread
> Operator asked in chat for a second kind of calendar. Existing calendars become "scoring"
> calendars; the new kind is "Getting Stuff Done" (GSD): an ADHD-oriented hierarchical todo list
> with its own scoring calendar. What are the exact scoring rules and data model? (UI is
> thread 0009.)
>
> My reading of the rules — Q1. Confirm or correct each:
>   a. Adding a top-level todo earns +1 point on the day it is added.
>   b. Each todo has a bounty (points) and a due date, set when it is added.
>   c. Marking it done on or before its due date earns the full bounty on the day it is marked
>      done; after the due date, half the bounty.
>   d. "Smallest thing I can do to move this forwards" adds a child todo. Creating it earns +0.5
>      on its creation day. Its bounty is 0.5 points — a fixed 0.5, not half the parent's
>      bounty — and its due date starts as the parent's.
>   e. Children can have children, without a depth limit, by the same rules as (d).
> Q2. Editing: can bounty and due date be changed after creation (including a child's)? Is a
> due date required, or can a todo have none (and then always count as on time)? Proposed:
> both editable; due date optional; new top-level todos default to bounty 1, no due date.
> Q3. Reversals: points are derived from each todo's created and done dates, so un-ticking a todo
> removes its completion points and deleting a todo removes all its points (creation included).
> Alternative: earned points are permanent once earned, even if the todo is deleted. Which?
> Proposed: derived — the score always matches what the list shows.
> Q4. Parents and children: marking a parent done leaves its open children as they are (they
> can still be done and scored); deleting a parent deletes its subtree. Proposed: yes.
> Q5. Chart and totals: GSD points join the daily score chart as positive score on the day earned.
> A GSD calendar's heatmap shows points earned per day; its header total is total points.
> Sorting (thread 0007) treats it by those points and the latest day with points.
> Proposed: yes.
> Q6. Data model: a GSD calendar is one entry in the calendar list (`kind: 'gsd'`) holding its
> todos; its daily points are computed from the todos rather than stored as counts, so the two
> can never disagree. It has no activity value. It travels in export/import and goes to trash
> like any calendar. Stored state moves to a new version with a migration that marks every
> existing calendar `kind: 'scoring'`. Proposed: yes.
> Q7. Any number of GSD calendars, created from the create bar with a kind choice
> (Scoring / Getting Stuff Done). Proposed: yes.
