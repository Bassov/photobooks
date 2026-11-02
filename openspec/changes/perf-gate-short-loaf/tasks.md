## Implementation

- [x] 1. `FLING_LOAF_IGNORE_BLOCKING_MS` in `e2e/perf/budgets.ts`; `judgeFlingLoaf` + `assertFlingLoafBudget` in `e2e/perf/flingLoafGate.ts`.
- [x] 2. Unit tests `scripts/perf-lane-fling.test.mjs` (≤ 5 ms passes, series of 5–20 ms fails, > 20 ms fails, observer off fails, perf-lane parses the message). 13 tests green.
- [x] 3. Switch the three fling gates (`thumb-warm-slice`, `thumb-bulk-hydrate`, `thumb-hot-cache`) to `assertFlingLoafBudget`.
- [x] 4. Canary: a 200 ms busy loop and a series of 65 ms tasks fail `assertFlingLoafBudget` in a real browser (`e2e/loaf-gate-canary.spec.ts`, 20/20 with `--repeat-each=10`).

## Manual test scenarios

N/A: test gate only, no product UI change.
