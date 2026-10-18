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
