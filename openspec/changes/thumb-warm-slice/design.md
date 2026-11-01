## Decisions

1. **Resumable pass.** `runWarmPass` becomes a pass object: a gallery / window / book-used snapshot taken at pass start, plus cursors. It steps in units: index one `window.order` entry, scan one gallery id, or start one job. After each unit it checks `performance.now()` against `WARM_SLICE_BUDGET_MS = 3`. Once the budget is spent, the pass reschedules via `scheduleWhenNowEmpty` and resumes there. Every slice runs at least one unit.
2. **Streaming top-k, same order.** Sorting every candidate takes O(N log N) as one unit, and that cost grows with gallery size, so the sort cannot fit in a slice. A pass only needs `cap − inFlight` picks. Top-k insertion on the rank key that `orderWarmCandidates` now shares gives the same picks, because ranks never tie.
3. **Coalescing.** A request while a pass is open sets `rerunRequested`. When the pass ends, one new pass is queued. Import start and uninstall drop the open pass. Each start reads the slot cap again.
4. **Seam.** The stats gain `settledCount` (number of `assetId+cacheKey` entries the lane is done with) and `longestSliceMs`.

## Touch-set & Test Plan

- Files: `src/editor/thumbBackgroundWarm.ts`, `src/editor/thumbBackgroundWarm.test.ts`, `e2e/perf/perfFixture.ts` (LoAF script attribution helpers), new `e2e/thumb-warm-slice.spec.ts` (`frame-budget gates` describe), roadmap item.
- Reuse: `scheduleWhenNowEmpty`, `browserBeginLoafScenarioWindow`, `browserAssertNoLoaf`, `__photobooksThumbs`.
- Unit (mocked `performance.now`):
  - a 40-item pass runs as several slices that stop at the budget;
  - picks equal `orderWarmCandidates` (incl. ids missing from the window order);
  - one rerun per open pass;
  - import start drops the pass.
- e2e: save N cached thumbs, reload, fling the strip under 2× while the cold lane runs. Log LoAF scripts; `browserAssertNoLoaf(0)`, `longestSliceMs < 50`, and all N settled (the completion time is logged).
