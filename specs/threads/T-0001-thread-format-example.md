---
id: 0001
affects:
  specs: []
  paths: [specs/threads/T-0001-thread-format-example.md]
tags: [process, threads, example]
links: {}
---
## Outcome
Decision: this thread is kept permanently in specs/threads/ as the reference example of the thread format. Never delete it, rename it, or move it out of state T.
Rejected:
1. A separate specs/threads/examples/ directory: sweeps and searches would need exceptions, and the example would no longer show the real layout.
2. Describing the format only in prose: an example shows conventions that prose leaves ambiguous.
Reopen if: the format changes. Then update this example in the same commit.

## Thread
> Every thread needs a reference that shows the format in use.
> Q1. Keep this thread permanently as that example?
> Q2. Keep it in specs/threads/ alongside real threads, or in a separate examples/ directory?

yes
with the others

> Q1: adopted.
> Q2: I read "with the others" as: keep it in specs/threads/ and reject the separate directory. Confirm?

confirmed
decided

> Applied: no spec or code change is needed; the decision is this file's existence. Renamed A → R → T.
