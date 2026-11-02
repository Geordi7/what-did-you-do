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

> Operator asked in chat (2026-11-02) whether the app is ready to deploy as an Azure Static Web
> App. The build is: `npm run build` emits a self-contained `dist/` with the CSP meta tag; hash
> routes need no rewrite; nothing server-side exists. The suite is green (273 unit, 92 browser,
> 1 preview). What is missing is the decision this thread holds, plus three small pieces it would
> bring:
>
> Q1. Is Azure Static Web Apps the deploy target, and `npm run build` the release step? If so,
> this thread moves to resolved with that outcome.
> Q2. How does it deploy: (a) GitHub Actions from a GitHub repo (Azure generates the workflow;
> app location `/`, output `dist`), or (b) the SWA CLI (`swa deploy ./dist`) from this machine,
> with no remote? This repo has no Git remote today. I recommend (a).
> Q3. Add `staticwebapp.config.json` with response headers: the CSP plus `frame-ancestors 'none'`
> (which 07 assigns to hosting), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
> and long caching for hashed `assets/`? I recommend yes.
> Note: data lives in each origin's `localStorage`, so data from wherever the app runs today does
> not follow it to the Azure URL; moving it needs an export there and an import on Azure.
