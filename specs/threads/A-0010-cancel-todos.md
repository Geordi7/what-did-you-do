---
id: 0010
affects:
  specs: [03-03-calendars.md, 03-04-gsd-points.md, 03-01-migrations.md, 04-06-todo-page.md, 04-03-dialogs.md, 04-design.md, 06-accessibility.md]
  paths: [src/gsd.ts, src/types.ts, src/schemas.ts, src/migrations.ts, src/components/TodoPage.tsx]
tags: [gsd, todo, cancel, delete, dialog, migration]
links: {related: [0008, 0009]}
---
## Thread
> Operator asked in chat: replace a todo's direct Delete with Cancel. Cancelling removes all of the
> todo's scoring and moves it to a "cancelled" bucket after the completed ones; Delete, behind a
> modal confirmation, is offered only from the cancelled group. How exactly should cancel work?
>
> My reading: Cancel replaces Delete on every row. A cancelled todo earns nothing — creation and
> completion points both go — and is stored with the day it was cancelled. Delete is offered only on
> cancelled todos and asks for confirmation first. Questions:
>
> Q1. Nudges: cancelling a todo also cancels its whole subtree (its Nudges stop scoring too).
> Proposed: yes — a cancelled task's steps are cancelled with it.
> Q2. Can a cancelled todo be restored? Proposed: yes, a Restore button in the cancelled group puts
> it (and its subtree) back as it was, done or open, with its points back.
> Q3. Where is the bucket? Proposed: per sibling group, like done todos — open, then done, then
> cancelled, at each level. Alternative: one "Cancelled" section at the bottom of the page, holding
> every cancelled todo flat or as its own tree.
> Q4. Can a done todo be cancelled? Proposed: yes — cancelling removes its points whatever its
> state. A cancelled Nudge no longer counts as an open child, so its parent can then be ticked.
> Q5. The confirmation: the app's only native dialog today is the trash's "Delete forever"
> `confirm`. Proposed: an in-app modal like the import review (focus trapped, Escape cancels),
> naming the todo and how many Nudges go with it — and the trash's Delete forever switches to the
> same modal, so the app has no native dialog left. Or keep both native `confirm`.
> Q6. Look: cancelled todos dimmed and italic, not struck through (strike means done), with a
> "Cancelled" note. Proposed: yes.
>
> Storing the cancelled day is a change to the saved shape, so this moves storage to version 8
> with a migration that changes nothing in existing data.
>
> When these are settled, say "decided".
