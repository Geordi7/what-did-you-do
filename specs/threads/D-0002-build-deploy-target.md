---
id: 0002
affects:
  specs: [02-architecture.md, 07-security-standard.md]
  paths: [dist/, package.json]
tags: [deployment, build, release]
links: {}
---
## Thread
> Migrated from `DECISIONS.yaml` item D12.
> Nothing records where `dist/` goes.
> No hosting, no base path, no release step.
> The half-tracked `dist/index.html` hints at a manual copy somewhere.
> Where is this deployed, and is `npm run build` the release step?

"12 Accept"

> The recommendation for this item read "Needs your answer", so accepting it is a no-op — this one is still genuinely open.
>
> It also gates part of D11: whether the app is ever served over plain HTTP from a LAN IP determines how much the `crypto.randomUUID` fallback actually matters.

Defer indefinitely, resolve when the app is mature.

> Deferring costs nothing, which is worth recording so it is not reopened out of caution.
>
> Its two dependents were both closed without it: the `randomUUID` fallback is implemented, so a plain-HTTP LAN origin is already safe whatever the answer turns out to be; and the CSP is attached to the built output by a build-time plugin, so it needs nothing from a host.
>
> What stays unanswered is only where `dist/` goes and whether `npm run build` is the release step — neither of which blocks any remaining work.
