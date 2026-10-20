---
id: 0009
affects:
  specs: [04-design.md, 04-05-calendar-grid.md, 04-06-todo-page.md, 04-01-score-chart.md, 01-requirements.md, 02-architecture.md, 06-accessibility.md, 04-02-copy.md]
  paths: [src/App.tsx, src/components/, src/App.css]
tags: [gsd, todo, ui, navigation, accessibility]
links: {related: [0008]}
---
## Outcome
Decision: a GSD calendar shows in the calendar list, visually distinct (a checkbox icon before the
name, a "GSD" tag, a left edge in its colour). Clicking its section opens a full-page todo tool at
hash URL `#/gsd/<id>`; Back and a visible "← Calendars" control return to the list. Its day cells
never change counts.
- Every grid, scoring and GSD alike, shows 22 weeks back and 4 weeks forward (26 columns), so all
  grids line up. Future days are hatched; on scoring calendars they are not clickable.
- A thin stepped line in the gaps between cells separates the months; no background banding,
  and cell colours are unchanged.
- A day with open todos due shows a thick dot in its centre in the foreground colour, red once the
  day has passed with todos still open, nothing once all are done.
- The score chart's weekly view becomes "Last 22 weeks", with no future columns.
- GSD day hover detail: date, then "Created N · Finished M · Due K · +P points".
- Todo page: the GSD calendar at the top; a compact add row (title, bounty, due date); then the
  tree, by due date then creation, done todos sinking to the bottom of their sibling group. Each
  todo has a done checkbox, title, bounty, due date, and Nudge; children indent and collapse.
- Clicking a day on the todo page filters the list to todos created, finished or due that day;
  clicking it again, or any interaction outside the list, clears the filter.
- The GSD calendar menu matches a scoring calendar's, with default bounty in place of activity
  value.
Rejected:
1. Path URLs via the History API: every host would need an index.html rewrite, and the deploy
   target is still open (thread 0002). Hash URLs work on any host and from `file://`.
2. Clicking a GSD day to add counts: its counts come from todos.
3. Upcoming due dates only listed on the page (grid unchanged): due dates belong on the grid.
4. Forward extension only as far as the latest due date, or on GSD grids only: grids must line up.
5. Month shown by alternating empty-cell shades: the month shows behind the cells only.
7. Month bands behind the cells: tried and found noisy in both themes, even with tones swapped
   and contrast raised; the operator chose a separating line instead.
6. Ring due markers: a thick dot reads better at cell size.
Reopen if: a deploy host with rewrites is chosen and clean URLs are wanted.
## Thread
> Operator asked in chat: the GSD calendar is visible in the calendars list, visually distinct;
> clicking it opens a full-page todo tool with the same calendar at the top; hovering a day tells
> how many things were created/finished; due dates get a visual indication. How should the GSD
> UI work? (Scoring rules are thread 0008.)
>
> Q1. Navigation: the todo page has its own URL hash (`#/gsd/<id>`), so the browser Back button
> returns to the list, plus a visible "← Calendars" control. The score chart and other calendars
> are hidden on that page. Proposed: yes.
> Q2. In the list, clicking a scoring calendar's day adds a count. On a GSD calendar, counts come
> from todos, so: clicking anywhere on its section (name, grid, or an "Open" button) opens the
> todo page, and its day cells never change counts. Proposed: yes.
> Q3. Visually distinct: a checkbox icon before the name, a "GSD" tag, and a coloured left edge on
> the section in the calendar's colour. Proposed: yes — or say what you picture.
> Q4. Hover detail for a GSD day: date, then "Created N · Finished M · Due K · +P points".
> Proposed: yes.
> Q5. Due dates: the grid shows the trailing 26 weeks ending today, so upcoming due dates are
> off the grid. Options:
>   (a) extend GSD grids forward (e.g. 4 weeks) so upcoming due dates are visible;
>   (b) keep the grid as is: mark past/today due dates only, and list upcoming ones on the page.
> In both, a day with something due gets a small marker: a ring for open todos due, red for
> overdue (still open after its date). Proposed: (a) with 4 weeks.
> Q6. Todo page layout: an add row (title, bounty, due date) at the top; then the tree, sorted by
> due date then creation. Each todo shows a done checkbox, title, bounty, due date, and a
> "Smallest next step" button that adds a child inline. Children indent and can collapse. Done
> todos stay visible, struck through, with a "Hide done" toggle. Proposed: yes.
> Q7. Clicking a day on the todo page's calendar filters the list to todos created, finished or
> due that day; clicking it again clears the filter. Proposed: yes — or no day action at all.
> Q8. The GSD calendar's menu offers the same options as a scoring calendar's
> (colour, move, Export, Delete) minus activity value. Proposed: yes.

Q1: agree, must SPA urls be based on `#` fragments?
Q2: agree
Q3: agree
Q4: agree
Q5: a - extend calendar as needed (so all due dates within 4 weeks are visible) add a visual indication that differentiates past/future, apply the same indication to scoring calendars
Q6: good, keep the layout compact, push done todos to the bottom
Q7: good feature, but any interaction outside the todo list should clear this feature
Q8: yes

> Q2, Q3, Q4, Q8: adopted as proposed. Q6: compact layout, done todos sink to the bottom of their
> sibling group. Q7: any interaction outside the todo list (and outside the day that set the
> filter) clears it.
>
> On Q1's question — no, SPA URLs need not use `#`. Path URLs (`/gsd/<id>`) via the History API
> look cleaner, but every host must then serve `index.html` for any path, or a reload or bookmark
> on the todo page 404s. The deploy target is still deferred (thread 0002), and static hosts
> such as GitHub Pages have no such rewrite. Hash URLs work on any host and from `file://`, with no
> server setup. Proposed: hash now; path URLs could follow once thread 0002 picks a host with
> rewrites. Q1a: hash or path?
>
> On Q5 — my reading, plus two points:
> - Every grid extends forward just far enough to show the latest open due date within the next
>   4 weeks, across all GSD calendars, and not at all when none is due. The 26 weeks back stay.
> - Future days look different from past days (proposed: faint hatched cells), and the same
>   treatment applies to scoring calendars.
> Q5a. Should scoring calendars extend by the same weeks, so every grid's columns line up and the
> cross-calendar date highlight keeps working? Their future cells would be hatched and not
> clickable. Proposed: yes, all grids share one forward extension.
> Q5b. Due markers: a ring on a day with open todos due; red ring when that day has passed and they
> are still open; nothing once all are done. Proposed: yes.
>
> When these are settled, say "decided" and I write the outcome.

Q1: agree on hash url
Q5: so... let's shift to this:
- all calendars show 4 weeks forwards always, future days are hatched. so all calendars line up (5a)
- maybe reduce the history by a few weeks
- add an alternating background effect to show which month each day is associated with
- lets make due dates a thick Dot in the middle of that day, same color approach

decided or needs more?

> Q1: hash URLs, adopted.
>
> Q5, my reading (this replaces Q5a/Q5b):
> - Every grid, scoring and GSD alike, shows 22 weeks back and 4 weeks forward: 26 columns, the
>   same width as today, so all grids line up and the cross-calendar date highlight keeps working.
> - Future days are hatched. On scoring calendars they are not clickable.
> - Days alternate between two backgrounds by calendar month, so each day's month is visible at
>   a glance.
> - A day with open todos due gets a thick dot in its centre, in the foreground colour; the dot
>   turns red once the day has passed with todos still open; no dot once all are done.
>
> Two points left:
> Q5c. The alternating month background: cells with counts carry the heatmap colour, so the
> month shows on empty cells only (two neutral shades, alternating by month), plus a faint band
> behind the cells for the gaps. Proposed: yes.
> Q5d. The score chart's "Last 26 weeks" view: proposed it becomes "Last 22 weeks", matching the
> grid's history, and shows no future columns.
>
> If those hold, say "decided".

Q5c: only the background behind the cells, not the cell colors themselves
Q5d: agree

decided

> Decided. Month background goes behind the cells only; chart becomes "Last 22 weeks".

> Operator, in chat after seeing the month bands built: "month bands still look bad... can you do
> a line separating the months without any banding?" Applied: the bands are replaced by a stepped
> line in the gaps between months; Outcome updated to match.

> Applied: the 22-back/4-ahead grid with hatched future days and month lines, GSD sections in the
> list with due dots and day figures, the filter, and the todo page at `#/gsd/<id>`. Verified by
> the unit and browser tiers, every new assertion seen failing first.
