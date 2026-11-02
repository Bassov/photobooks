# perf-gate-short-loaf

Tag: feature
Milestone: P1
Title: Bug: /next-roadmap-item perf-gate-short-loaf

## Scope

- [x] Owner-approved gate change («Хорошо», 2026-11-02 08:44, option A wide): in the thumb fling perf scenarios (`thumb-warm-slice`, `thumb-bulk-hydrate`, `thumb-hot-cache`) a LoAF with blockingDuration ≤ 5 ms is not counted, whatever its source.
- [x] Still strict there: 0 LoAF > 20 ms, and repeated LoAF > 5 ms (≥ 2 in one scenario window) fails. `PERF_BUDGETS` values and non-fling scenarios unchanged.
- **Done when:** perf lane green 3/3 on the PR head and the three fling specs 3/3 locally; unit tests prove > 20 ms fails, a series of 5–20 ms fails, only ≤ 5 ms passes; the LoAF canary proves the fling gate catches a real busy loop.
- **Browser check:** N/A (test gate only; no product change).
