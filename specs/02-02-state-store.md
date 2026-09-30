# State Store

`src/store.ts` owns app state and every mutation of it.

## Container
- State lives in a `createStore` store from `solid-js/store`, not in a signal holding the whole state object.
- A mutation targets the touched calendar and the touched day. It does not spread or replace the calendar array to change one day.
- Standalone preference values that are not part of the state tree — theme, last export — stay signals.

## Surface
- The store exposes calendar CRUD, reorder, recover, permanent delete, and day mutation methods.
- Components read through the store's getters, never through a copy taken before the markup.
- Every mutator that changes a calendar stamps that calendar's own last-update timestamp; a change
  to one calendar leaves the others' alone. `03-data-model.md` owns the field's meaning.

## Persistence
- State persists to `localStorage` under `achievement-calendars`.
- State migration handles schema upgrades on load.

## Cross-tab sync
- One `window` `storage` listener at store init, removed on teardown. It fires only in other tabs, never the writer; the design depends on that.
- Dispatch by key — the state key migrates, validates and reconciles state; the theme key updates the theme signal; the last-export key updates the export signal.
- Incoming state is applied with `reconcile`, so only the paths that actually differ change and unaffected rows keep their identity. It is never assigned over the store wholesale.
- A `null` `newValue` means another tab cleared storage; it is ignored and memory state stands.
- Loop guard: the store keeps the last written string, the save effect skips a write equal to it, and the handler sets it before reconciling state.
- Focused name and activity-value inputs keep in-flight edits.
- Two tabs writing in the same event-loop turn resolve last-write-wins.

## Test affordance
- `src/main.tsx` assigns the store to `window.__store`. This is deliberate: it is the handle browser-driven and manual tests use to read and drive state without a UI path.
- It is typed by augmenting the `Window` interface, not by a cast:

```ts
declare global {
  interface Window {
    __store?: typeof store
  }
}
```

- The property is optional, so nothing in the app may depend on it being present.
