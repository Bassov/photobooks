## Implementation

- [x] 1. Unit tests first: the pass runs as several budgeted slices; the picks equal `orderWarmCandidates` (incl. ids missing from the window order); a request during an open pass gives one rerun; import start drops the pass (`src/editor/thumbBackgroundWarm.test.ts` `sliced passes`; 3 of them fail with the budget check removed).
- [x] 2. Resumable sliced pass with streaming top-k on the shared rank key, plus the `settledCount` / `longestSliceMs` stats seam (`src/editor/thumbBackgroundWarm.ts`).
- [x] 3. LoAF script attribution helpers in `e2e/perf/perfFixture.ts` (`browserStartLoafScripts` / `browserTakeLoafScripts`).
- [x] 4. `frame-budget gates` e2e `e2e/thumb-warm-slice.spec.ts`: reopen with a cold warm lane, fling under 2×, and log the LoAF scripts, the longest slice and the warm completion time. Assert 0 LoAF, a longest slice under 50 ms, and every asset settled. Results: 3/3 green after; 3/3 red on main (warm-pass LoAF 55–68 ms, longest pass 97 ms).

## Manual test scenarios

1. Reopen a book with a large photo folder; right after "Book restored" fling the filmstrip end to end and back: no hitch while the warm lane runs (LoAF log shows no warm-pass script).
   - OK (real path, `e2e/thumb-warm-slice.spec.ts`, 1000 photos, 2× throttle, 9 runs): 0 LoAF with a warm-pass script, gate green 9/9; `manual-qa` not run (no UI change).
