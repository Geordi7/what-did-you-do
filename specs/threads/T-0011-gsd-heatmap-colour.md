---
id: 0011
affects:
  specs: [03-04-gsd-points.md, 04-05-calendar-grid.md, 04-04-calendar-sort.md, 03-03-calendars.md]
  paths: [src/gsd.ts, src/calendar-figures.ts, src/components/CalendarGrid.tsx]
tags: [gsd, heatmap, scoring, sorting]
links: {supersedes: 0008}
---
## Outcome
Decision: a GSD day's activity count is its todos done that day at any depth, root todos and
Nudges alike: the same figure as the detail panel's "Finished". It colours the heatmap, is the
calendar's total activities (the number its section and an import row show), and feeds sorting's
Activities and the chart breakdown's count. Points, creation points and the chart's score are
unchanged. This replaces thread 0008's rule that the count is root todos done.
Rejected:
1. Root todos done only (0008's rule): days where only Nudges were finished stay blank, so the grid
   hides real work.
2. Colour by points earned: keeps the colour a count of things done, consistent with scoring
   calendars, as 0008 reasoned; bounties would weight the colour.
3. Created plus finished: adding a todo is not getting it done.
4. A separate figure for colour while totals and sort keep root todos done: colour, total and sort
   would disagree.
Reopen if: Nudge-heavy days drown out root completions in the colour.

## Thread
> Operator reports GSD calendar days "stay blank" where work happened. Per thread 0008 a GSD day's
> colour is its **activity count**: root todos done that day. Finished Nudges, created todos and
> points earned leave a day blank. Behaviour matches spec; the question is whether the spec is right.
> This reopens only 0008's heatmap rule (and its rejected alternative 5, colour by points).
>
> Q1. What should a GSD day's colour follow?
> - (a) **Todos finished at any depth** (the detail panel's "Finished M"). Nudges show up; colour
>   still counts things done, like a scoring calendar's count. *Recommended.*
> - (b) **Points earned** that day. Creation and finishing both show; bounties weight the colour.
>   0008 rejected this to keep colour consistent with scoring calendars.
> - (c) **Created + finished**, any depth: every todo action shows.
> - (d) Keep root todos done.
>
> Q2. Should the same figure become the calendar's total activities and sorting's Activities, or
> should those stay root todos done while only the colour changes? I recommend one figure for all
> three, so the colour, total and sort agree.

Q1: a (add nudges) Q2: yes

> Reading: a GSD day's activity count becomes todos done that day at any depth, root todos and
> Nudges alike (the detail panel's "Finished M"). That one figure colours the heatmap, is the
> calendar's total activities, and feeds sorting's Activities. Points, creation and the chart are
> unchanged. Confirm, and say "decided" to resolve.

decided

> Resolved as read above. Applying: specs 03-03, 03-04, 04-04, 04-05, 05-01; `src/gsd.ts`,
> `src/calendar-figures.ts` and their tests.

> Applied and verified: the changed unit tests failed first on the old root-only count (8 failures),
> then all 273 pass with typecheck clean. Renamed R → T.
