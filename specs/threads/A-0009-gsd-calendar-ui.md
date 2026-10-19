---
id: 0009
affects:
  specs: [04-design.md, 02-architecture.md, 06-accessibility.md, 04-02-copy.md]
  paths: [src/App.tsx, src/components/, src/App.css]
tags: [gsd, todo, ui, navigation, accessibility]
links: {related: [0008]}
---
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
