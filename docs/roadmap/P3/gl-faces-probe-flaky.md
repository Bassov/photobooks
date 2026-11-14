# gl-faces-probe-flaky

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item gl-faces-probe-flaky
Status: done

## Scope

- [ ] Reproduce `e2e/gl-faces-probe.spec.ts` «6 pages at 2× paint without a long task over 50 ms» locally (`--repeat-each`, CPU throttling) and attribute the long tasks to our functions (LoAF scripts, Chrome trace).
- [ ] The GL face source (`src/site/book/gl/faces.ts`) and the open book's endpaper (`src/site/book/gl/open.ts`) do their per-texel work (page paint raster, grain) in small row bands, one band per task; painting never runs in the caller's task. Every caller of the sliced path keeps working (PR body lists them).
- **Done when:** the attributed long tasks are gone from our code; the spec passes 20/20 locally with `--repeat-each=20`; the PR body has before/after longest-task numbers (max and median).
- **Perf:** no long task over 50 ms from face painting; the test's 50 ms threshold, page count, scale, observer and `PERF_BUDGETS` stay unchanged.
- **Browser check:** N/A (no visible change: same faces, same grain).
- **Hard nos:** no loosening of the gate; fixes stay in `src/site/book/**` and its unit tests.
