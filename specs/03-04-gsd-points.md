# GSD Points

Refines `03-data-model.md`. A GSD calendar's points and activity counts are derived from its todo
tree on every read; nothing derived is stored.

## Terms
- A **root todo** sits in the calendar's `todos`. A **Nudge** is any todo in another's `children`:
  "the smallest thing I can do to move this forwards".
- A todo is **open** until it has a `done` date.
- A todo is **on time** when it has no due date, or its `done` date is on or before its due date.

## Points
- Creation: a root todo earns 1 point on its `created` day; a Nudge earns 0.5.
- Completion: a done todo earns its `bounty` on its `done` day when on time, and half its
  `bounty` when late.
- A day's points are the sum of every creation and completion point landing on it, across the
  whole tree. Points are never negative.
- Un-ticking a todo removes its completion points; deleting a todo removes its subtree and every
  point the subtree earned, creation included.

## Per-day figures
For each date a GSD calendar reports:
- **activities** — root todos whose `done` is that date; it colours the heatmap and feeds
  sorting's Activities;
- **points** — as above; they join the chart as positive score, sorting's Score, and the header;
- **created** and **finished** — todos of any depth created, and done, that date;
- **due** — open todos whose due date is that date.

## Rules for todos
- A new root todo's bounty is prefilled from the calendar's `defaultBounty` and can be edited; its
  due date is prefilled one week after today, and can be changed or removed.
- A Nudge's bounty is a fixed 0.5. It starts with its parent's due date, which can be changed or
  removed.
- Marking a todo done records a `done` date: today, or an earlier day not before its `created`.
  A done todo's `done` date can be moved within the same bounds.
- A todo with an open child cannot be marked done. A todo whose parent is done cannot be un-ticked,
  and a done todo takes no new Nudge.
- **Promote** moves a Nudge, with its subtree, from its parent's children to its grandparent's,
  after the parent. Promotion between Nudge levels changes no stored field. Promotion to root makes
  it a root todo: its creation point becomes 1 on its original `created` day, and its bounty
  becomes the larger of 0.5 and the calendar's `defaultBounty`.
