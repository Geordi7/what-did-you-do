# Security Standard

## Data locality
- All data stays on the device, in `localStorage`. Nothing leaves the browser.
- No accounts, no sign-in, no server, no cross-device sync, no telemetry, no analytics.
- Export and import are the only data movement, and both are user-initiated and local:
  a file the user saves and a file the user chooses.

## Content-Security-Policy

The policy is attached to the **built output only**, by a `transformIndexHtml` plugin in
`vite.config.ts` scoped with `apply: 'build'`, which injects it as a
`<meta http-equiv="Content-Security-Policy">` tag into `dist/index.html`.
It is never a `<meta>` tag in the source
`index.html`: that tag would also apply in dev, where it breaks the Vite dev server's inline
scripts and its HMR socket. Attaching it at build time needs no cooperation from whatever hosts
`dist/`, so the policy does not wait on a hosting decision.

Directives, deliberately permissive where being strict would break something:

- `default-src 'self'` — the app loads only its own bundled assets; everything unlisted falls
  back to this.
- `img-src 'self' data:` — **required.** The favicon is a `data:image/svg+xml,…` URI, so
  `data:` must stay allowed in `img-src`. Tightening this back to `'self'` alone blocks the
  favicon silently: the icon disappears with no console error worth noticing. Do not remove it.
- `style-src 'self' 'unsafe-inline'` — inline `style` attributes are still used in JSX, and CSP
  blocks those without `'unsafe-inline'`. This is the one real concession, and it is required for
  as long as any inline style attribute survives; it can be dropped once none remain.
- `script-src 'self'`, `connect-src 'self'`, `object-src 'none'`, `base-uri 'self'`,
  `form-action 'none'` — the app has no submitting forms, no plugins, and talks to nothing.

`frame-ancestors` is omitted: it has no effect except as a response header, so framing control
belongs to hosting.

### No inline script
- There is no inline script and no boot script, so `script-src 'self'` stands alone: no
  `'unsafe-inline'` and no `'sha256-…'` hash to recompute on every change.
- This holds because the theme is not read before first paint: first paint resolves `system`,
  and the stored theme choice is applied after state load.
- Accepted consequence: a user whose stored choice differs from their system setting sees the
  system theme for one frame. That is the cost of keeping the script policy clean, and it is
  preferred over relaxing it.

## Imports are untrusted
- An imported file is untrusted input, regardless of whether the app wrote it.
- Every import is shape-validated before it reaches state, and validation runs after migration
  on every load and every import — not only on import.
- Validation is schema parsing, one schema per storage version. A migration step validates its
  input with the schema for the version it reads; the current-version schema also supplies
  defaults. No hand-rolled coercion and no `as any` casts sit alongside it.
- Imported payloads are capped at 50 MB. A selected file over the cap is rejected using its byte size before reading; string callers are checked before parsing. The shared cap is exported from the persistence contract. The
  the rejection surfaces on the inline status line. The cap is a parse-time guard against a hostile
  or absurd file, not a promise that anything under it persists: `localStorage`'s own quota is
  roughly 5-10 MB per origin, so a payload near the cap can be parsed and still never be saved.
  That write fails and surfaces in the storage-error banner, not on the import status line. The
  browser quota is the real limit on what can be restored.
- Nothing from an import is evaluated, interpolated into markup, or used as a URL. Names and
  colors are rendered as text and as style values only.

## Dependencies
- The import validator is `@badrap/valita` (~3KB, TypeScript-first).
- It is the project's first runtime dependency beyond `solid-js`, taken deliberately against
  the otherwise dependency-free local-first stance. Further runtime dependencies need the same
  scrutiny.
