---
id: 0010
affects:
  specs: [03-03-calendars.md, 03-04-gsd-points.md, 03-01-migrations.md, 04-06-todo-page.md, 04-03-dialogs.md, 04-design.md, 06-accessibility.md]
  paths: [src/gsd.ts, src/types.ts, src/schemas.ts, src/migrations.ts, src/components/TodoPage.tsx]
tags: [gsd, todo, cancel, delete, dialog, migration]
links: {related: [0008, 0009]}
---
## Outcome
Decision: a todo's Delete becomes **Cancel**. A cancelled todo, with its whole subtree, earns
nothing — creation and completion points alike — and drops out of every per-day figure; it is
stored with the day it was cancelled. Cancelled todos sit at the bottom of their level, after the
done ones, so cancelled root todos end up at the bottom of the page and cancelled Nudges at the
bottom of their sibling group. They show dimmed and italic with a "Cancelled" note, not struck
through. A cancelled todo offers **Restore**, which puts it back as it was, done or open, points
included, and **Delete**, which removes it and its subtree after a native `confirm`.
- Any todo can be cancelled, done or open. A cancelled Nudge no longer counts as an open child.
- The flag sits on the todo that was cancelled; its descendants are cancelled with it. Restore
  clears only that flag, so a Nudge cancelled on its own before stays cancelled.
- Storage moves to version 8; the migration changes no existing data.
Rejected:
1. Direct Delete on any todo: losing points and history should take two steps.
2. One flat "Cancelled" section at the bottom of the page: cancelled Nudges stay with their level.
3. An in-app confirmation modal: the native `confirm` is kept, as for the trash's Delete forever.
4. Cancelling only the todo and keeping its Nudges scoring: a cancelled task's steps go with it.
Reopen if: deleted todos need to be recoverable, or the app's native dialogs are replaced.

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

Q1: yes
Q2: yes
Q3: cancelled nudges sit at the bottom of their level, cancelled root tasks move to the bottom of the page after the done tasks
Q4: yes
Q5: use native
Q6: yes

decided or?

> Reading: Q3 is the proposal's per-level order — open, done, cancelled at every level — which puts
> cancelled root todos at the bottom of the page after the done ones. Nothing else is open, so I am
> taking this as decided; Outcome above. One detail decided as technical: the cancelled flag sits on
> the todo you cancel, its Nudges inherit it, and Restore clears just that flag.
