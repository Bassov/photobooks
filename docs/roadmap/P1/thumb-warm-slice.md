# thumb-warm-slice

Tag: feature
Milestone: P1
Title: Bug: /next-roadmap-item thumb-warm-slice
Status: done

## Scope

- [ ] Slice `runWarmPass` (`src/editor/thumbBackgroundWarm.ts`): the gallery scan, the warm order and the job starts run in ≤ 3 ms slices that yield through `scheduleWhenNowEmpty` and resume where they stopped. Warm order, what gets warmed and the slot cap stay as they are; only the pacing changes.
- **Done when:** unit test: a pass over N items runs as several slices, each stops once the budget is spent (fails without slicing). New `frame-budget gates` scenario: reopen a gallery with a cold warm lane, fling the strip under the 2× throttle, log every LoAF script (`sourceURL` / `sourceFunctionName` / duration), `browserAssertNoLoaf(0)`; no LoAF attributed to the warm pass.
- **Browser check:** reopen a book with a large photo folder and fling the strip right after "Book restored": no hitch while the warm lane runs.
- **Perf:** no `PERF_BUDGETS` change; PR body reports the longest warm-pass task, LoAF counts (our code vs other) and warm completion time, before and after.
- **Test:** unit (slices) + perf e2e
- **Depends:** thumb-background-warm
