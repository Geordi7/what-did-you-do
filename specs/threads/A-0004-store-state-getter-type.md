---
id: 0004
affects:
  specs: [02-02-state-store.md, 03-data-model.md]
  paths: [src/store.ts, src/types.ts, e2e/harness.ts]
tags: [store, types]
links: {}
---
## Thread
> Migrated from an observation in `02-02-state-store.md`; the observation convention is gone from `00-meta.md`.
>
> The `state` getter is typed `AppState`, which does not describe what the store holds.
> `AppState.theme` is optional and the state behind the getter has no theme field at all — theme is a signal, read through `get theme()` — so `store.state.theme` is permanently `undefined` rather than merely possibly absent.
> `version` and `chartRange` are optional in `AppState` and always set in the state, so every reader handles an absence that cannot occur; the browser tier's `storageVersion` helper throws on it to stay honest.
> The getter wants a type describing the state tree, which is not the persisted envelope's type even though both are `AppState` today.
>
> Q1. Give the `state` getter its own state-tree type, separate from the persisted envelope's `AppState`, and spec that split in `02-02-state-store.md`?
