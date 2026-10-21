# GSD Points

Refines `03-data-model.md`. A GSD calendar's points and activity counts are derived from its todo
tree on every read; nothing derived is stored.

## Terms
- A **root todo** sits in the calendar's `todos`. A **Nudge** is any todo in another's `children`:
  "the smallest thing I can do to move this forwards".
- A todo is **cancelled** when it, or any ancestor, has a `cancelled` date. A cancelled todo
  earns no points and counts in no per-day figure.
- A todo is **open** until it has a `done` date, unless it is cancelled.
- A todo is **on time** when it has no due date, or its `done` date is on or before its due date.

## Points
- Creation: a root todo earns 1 point on its `created` day; a Nudge earns 0.5.
- Completion: a done todo earns its `bounty` on its `done` day when on time, and half its
  `bounty` when late.
- A day's points are the sum of every creation and completion point landing on it, across the
  whole tree. Points are never negative.
- Un-ticking a todo removes its completion points; cancelling a todo removes every point its
  subtree earned, creation included, until it is restored; deleting removes the subtree outright.

## Per-day figures
For each date a GSD calendar reports:
- **finished** — todos of any depth done that date, root todos and Nudges alike. It is the day's
  activity count: it colours the heatmap and feeds sorting's Activities and the chart's counts;
- **points** — as above; they join the chart as positive score, sorting's Score, and the header;
- **created** — todos of any depth created that date;
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
- **Cancel** stamps today as a todo's `cancelled` date; any todo not already cancelled can be
  cancelled, done or open. A cancelled todo cannot be ticked, un-ticked, Nudged, promoted or edited.
- **Restore** clears the `cancelled` date of a todo that carries one and has no cancelled ancestor;
  it comes back as it was, done or open. A Nudge that carried its own date stays cancelled.
- **Delete** removes a todo that carries a `cancelled` date, with its subtree.
- **Promote** moves a Nudge, with its subtree, from its parent's children to its grandparent's,
  after the parent. Promotion between Nudge levels changes no stored field. Promotion to root makes
  it a root todo: its creation point becomes 1 on its original `created` day, and its bounty
  becomes the larger of 0.5 and the calendar's `defaultBounty`.
