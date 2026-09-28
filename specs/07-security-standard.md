# Security Standard

## Data locality
- All data stays on the device, in `localStorage`. Nothing leaves the browser.
- No accounts, no sign-in, no server, no cross-device sync, no telemetry, no analytics.
- Export and import are the only data movement, and both are user-initiated and local:
  a file the user saves and a file the user chooses.

## Content-Security-Policy
- `default-src 'self'` — the app loads only its own bundled assets.
- `img-src 'self' data:` — **required.** The favicon is a `data:image/svg+xml,…` URI, so
  `data:` must stay allowed in `img-src`. Tightening this back to `'self'` alone blocks the
  favicon silently: the icon disappears with no console error worth noticing. Do not remove it.

### No inline script
- There is no inline script and no boot script, so `default-src 'self'` stays intact with
  no `'unsafe-inline'` and no `'sha256-…'` hash to recompute on every change.
- This holds because the theme is not read before first paint: first paint resolves `system`,
  and the stored theme choice is applied after state load.
- Accepted consequence: a user whose stored choice differs from their system setting sees the
  system theme for one frame. That is the cost of keeping the policy clean, and it is preferred
  over relaxing the policy.

## Imports are untrusted
- An imported file is untrusted input, regardless of whether the app wrote it.
- Every import is shape-validated before it reaches state, and validation runs after migration
  on every load and every import — not only on import.
- Validation is schema parsing, one schema per storage version. A migration step validates its
  input with the schema for the version it reads; the current-version schema also supplies
  defaults. No hand-rolled coercion and no `as any` casts sit alongside it.
- Imported payloads are capped at 5 MB. A file over the cap is rejected before it is parsed, and
  the failure surfaces on the inline status line.
- Nothing from an import is evaluated, interpolated into markup, or used as a URL. Names and
  colors are rendered as text and as style values only.

## Dependencies
- The import validator is `@badrap/valita` (~3KB, TypeScript-first).
- It is the project's first runtime dependency beyond `solid-js`, taken deliberately against
  the otherwise dependency-free local-first stance. Further runtime dependencies need the same
  scrutiny.
