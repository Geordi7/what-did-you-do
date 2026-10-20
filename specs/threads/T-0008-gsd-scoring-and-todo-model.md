---
id: 0008
affects:
  specs: [01-requirements.md, 03-data-model.md, 03-03-calendars.md, 03-04-gsd-points.md, 03-01-migrations.md, 03-02-import-export.md, 04-01-score-chart.md]
  paths: [src/types.ts, src/scores.ts, src/schemas.ts, src/migrations.ts, src/store.ts]
tags: [gsd, todo, scoring, data-model, migration]
links: {related: [0009, 0007]}
---
## Outcome
Decision: calendars come in two kinds. Existing calendars are **scoring** calendars. A **Getting
Stuff Done** (GSD) calendar is a hierarchical todo list whose daily points are derived from its
todos, never stored as counts. Any number of each may exist; the create bar offers the kind.
- A todo has a title, a bounty, an optional due date, a creation date and an optional done date.
- Adding a root todo earns 1 point on its creation day. Its bounty is prefilled from the calendar's
  **default bounty** (a per-calendar setting, default 1, changed from the calendar menu) and stays
  editable. Its due date is prefilled one week from today; it may be changed or removed.
- **Nudge** ("smallest thing I can do to move this forwards") adds a child todo to any todo, at any
  depth. A Nudge earns 0.5 on its creation day and has a fixed bounty of 0.5, whatever the calendar
  default. Its due date starts as its parent's and stays editable.
- Marking a todo done asks for the done date: today by default, or an earlier day not before its
  creation day. Done on or before the due date (or with no due date) earns the full bounty on the
  done date; after it, half. Un-ticking removes those points; deleting a todo deletes its subtree
  and every point it earned, creation included.
- A todo with an open child cannot be marked done.
- Promote moves a Nudge, with its subtree, up one level to its grandparent's children. Promotion
  between Nudge levels changes no points. Promotion to root makes it a root todo: creation earns 1
  on its original creation day, and its bounty becomes the larger of 0.5 and the calendar default.
- A GSD day's **activity count** is the number of root todos done that day; it colours the heatmap
  and feeds sorting's Activities. Its **score** is the points earned that day: it joins the chart,
  the header total and sorting's Score. Recent uses the latest day with any points.
- The sort bar gains a filter, All / Scoring / GSD, persisted with the sort.
- A GSD calendar travels in export/import and goes to trash like any calendar. Storage version 7
  adds `kind` (existing calendars become `scoring`), GSD todos and default bounty, and the filter.
Rejected:
1. Earned points kept after un-ticking or deleting: the score always matches the list.
2. Required bounty entry (empty field blocking Add): a prefilled default pushes without friction.
3. A Nudge bounty of half the parent's or half the calendar default: a Nudge is a fixed incentive
   to break tasks down; a task's value lives in its bounty.
4. Completing a parent with open children: work is finished bottom-up.
5. Heatmap colour by points: activity count keeps the colour consistent with scoring calendars.
6. Stored daily counts for GSD calendars: derived points can never disagree with the todos.
Reopen if: points need to survive todo deletion, or Nudge bounties need to vary.
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

Q1: looks good...
on d: let's call this 'Nudge'
Q2: we want to push the user in the direction of setting due dates and bounties, default due date of one week hence, allow 'removing' a due date
Q3: Agree, when completing, give a way to set an earlier completed date, to allow consistency
Q4: Two things:
- cannot complete a parent with open children
- a child has the option to be 'promoted' to its grandparent (up to the root). If a child gets promoted to its root then its derived scores get the corresponding boost: 1 point on creation day, and a 1 point bounty
Q5: The 'activity count' for a GSD calendar is number of root level activities completed, everything else yes.
Q6: 
- activity value as above, derived
- agree
Q7: agree... add to sort bar a filter button to filter for scoring calendars vs gsd calendars

> Thanks. My reading, then the points still open.
>
> Readings — confirm or correct:
> - Q1: (a)–(e) as written; the child action is called **Nudge**.
> - Q2: the add form always shows bounty and due date; due date is prefilled one week from today
>   (a Nudge starts with its parent's due date instead); a due date can be removed; both fields
>   stay editable.
> - Q3: points are derived. Marking done asks for the completion date, defaulting to today and
>   allowing an earlier date (not before the todo was created, not in the future). On-time vs
>   late is judged on that date, and the points land on that date.
> - Q4: a todo with any open child cannot be marked done (its checkbox is disabled, with the
>   reason as its label). Promote moves a Nudge up one level to its grandparent's children,
>   subtree included. Promotion between nudge levels changes no points.
> - Q5: a GSD calendar's **activity count** for a day is the number of root-level todos marked
>   done that day. Its **score** for a day is the points earned that day, which join the chart.
> - Q7: any number of GSD calendars; the sort bar gains a filter: All / Scoring / GSD.
>
> Open points:
> Q8. Bounty push: what should push the user to set a bounty? Proposed: the bounty field starts
> empty with placeholder "bounty", and Add stays disabled until it holds a number. (Due date is
> prefilled, so it pushes by default.) Or prefill 1, like the due date?
> Q9. Promotion to root: points become 1 on the original creation day, and the bounty becomes 1.
> If the user had already edited the Nudge's bounty (say to 3), does promotion keep 3, set 1, or
> take the larger? Proposed: the larger of the two.
> Q10. Heatmap: the cell colour for a GSD day follows its activity count (root todos done), like
> a scoring calendar; points show in the hover detail and the chart. Or should the colour follow
> points? Proposed: activity count, for consistency.
> Q11. Sort for GSD calendars: Activities = root todos done in the visible window; Score =
> points in the window; Recent = latest day with any points (created or done). Proposed: yes.
> Q12. The All / Scoring / GSD filter persists across reloads, with the sort. Proposed: yes.
>
> When these are settled, say "decided" and I write the outcome.

Q8: prefill 1, let's also have GSD-calendar setting that changes the default bounty for that calendar
Q9: Agree
Q10: Agree
Q11 agree
Q12 agree

decided or discuss Q8 further?

> Q9–Q12: adopted as proposed.
>
> Q8, my reading: each GSD calendar has a "Default bounty" setting (default 1), changed from its
> menu. A new root todo's bounty field is prefilled with that value and stays editable. One
> point to pin down before I write the outcome:
> Q8a. How far does the calendar default reach? Proposed:
> - creation points stay fixed: 1 for a root todo, 0.5 for a Nudge;
> - a Nudge's bounty starts at half the calendar default (0.5 when the default is 1);
> - on promotion to root, the bounty becomes the larger of its current value and the calendar
>   default (Q9), and the creation point is topped up to 1.
>
> If that reading holds, say "decided".

Nudges are worth 0.5 to create and 0.5 to complete, that's just an incentive to break down your big tasks into little ones. The task's value is in its bounty.

Everything else yes.

decided

> Decided. Reading recorded in the Outcome: a Nudge's bounty is a fixed 0.5 (not editable, not
> tied to the calendar default); a root todo's bounty is editable; promotion to root gives the
> larger of 0.5 and the calendar default.

> Applied: storage version 7 with calendar kinds, derived GSD points and the todo rules in
> `src/gsd.ts`, the calendar filter, and GSD collisions merging only by replace. Verified by the
> unit and browser tiers, every new assertion seen failing first.
