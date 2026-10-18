# Visible-window computation measurements

Measured locally on 2026-10-18 using headless Chromium against the Vite dev server.
One calendar held 20,000 or 60,000 consecutive real dates ending 2026-10-18,
with counts cycling from 1 to 9. After one warmup, twelve synchronous increments
were timed in each range. Timings include reactive UI work and immediate persistence.
CDP heap sampling used a 32 KiB interval and included collected allocations.
Allocation figures are sampled totals over twelve mutations, not retained heap.

| Stored days | Range | Median ms before → after | p95 ms before → after | Sampled allocation MB before → after |
|---|---|---|---|---|
| 20,000 | 28 days | 55.7 → 29.8 | 64.5 → 35.8 | 492.1 → 245.3 |
| 20,000 | 26 weeks | 56.8 → 31.0 | 62.9 → 37.7 | 487.4 → 239.7 |
| 60,000 | 28 days | 203.2 → 102.8 | 219.6 → 113.7 | 1397.2 → 680.3 |
| 60,000 | 26 weeks | 201.9 → 102.0 | 217.4 → 114.1 | 1376.0 → 687.0 |

This is one local comparison with sampling overhead, not a latency target or a
production benchmark. The change bounds chart aggregation and heatmap maxima to
visible dates. Full-history totals and synchronous serialization still scale with
stored history. These results support the narrow computation change; they do not
establish a need for cached indexes or a different persistence backend.

The benchmark script used for both runs is retained at `scripts/benchmark-history.mjs`.
Run `node scripts/benchmark-history.mjs label` to write a labelled JSON report to
`/private/tmp`; it starts and stops its own local server on port 5186 and Chromium.
