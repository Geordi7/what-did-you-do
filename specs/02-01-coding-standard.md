# Coding Standard

Rules for everything under `src/`.

## TypeScript
- `strict` stays on; no per-file or per-line opt-outs.
- No `as any`. Narrow with a type guard, or fix the type.

## Solid
- Read reactive values as getters inside JSX. Do not destructure props or pull a signal into a local before the markup.
- `createEffect` for side effects; `createMemo` only for derived values.
- Derive a `<For>` list inside a `createMemo` that reads the state it depends on, so the list re-renders when that state changes.
- Always clean up `document`-level listeners the component registered.
- No imperative DOM. Structure, attributes and text come from JSX and reactive expressions.

## CSS
- One stylesheet: `src/App.css`. No per-component files, no CSS modules.
- Styles are grouped by component, in component render order.
- Class names are prefixed per component — `.score-*`, `.cal-menu-*`, `.recover-*`.
