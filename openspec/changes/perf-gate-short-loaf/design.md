## Decisions

1. The fling gate lives on the test side in `e2e/perf/flingLoafGate.ts`; product `src/` is untouched. The browser hands over the `blockingDuration` of each entry in the scenario window (`getLoafEntries`, after `isLoafObserving`), and a pure `judgeFlingLoaf` judges them in Node.
2. Buckets by blockingDuration (b): b ≤ `FLING_LOAF_IGNORE_BLOCKING_MS` (5) is ignored. 5 < b ≤ `PERF_BUDGETS.loafNoiseBlockingMs` (20) is noise, at most `loafNoiseEntriesMax` (1) allowed. b > 20 is a real freeze, at most `loafEntriesMax` (0) allowed. "Repeated" = ≥ 2 entries over 5 ms in one window. The new constant sits outside `PERF_BUDGETS`, so no budget value moves.
3. Error message format unchanged, so `worstBlockingMs` in `scripts/perf-lane.mjs` still parses it (> 50 ms hard red).
4. Only the three fling gates switch to `assertFlingLoafBudget(page)`; every other `browserAssertNoLoaf` / `assertNoLoafEntries` caller is unchanged. The exemption lives only in the frame-budget "CI proxy gates" requirement.

## Touch-set & Test Plan

- Files: `e2e/perf/budgets.ts` (new constant), `e2e/perf/flingLoafGate.ts` (new), `e2e/thumb-warm-slice.spec.ts`, `e2e/thumb-bulk-hydrate.spec.ts`, `e2e/thumb-hot-cache.spec.ts`, `e2e/loaf-gate-canary.spec.ts`, `scripts/perf-lane-fling.test.mjs` (new). No quality-gate config edits.
- Reuse: `PERF_BUDGETS` thresholds; perf-lane message parsing.
- Tests: vitest `scripts/perf-lane-fling.test.mjs` (cases in tasks.md task 2); canary: a 200 ms busy loop fails `assertFlingLoafBudget` in a real browser; the three fling specs `--repeat-each` locally and 3/3 in the CI perf lane.
