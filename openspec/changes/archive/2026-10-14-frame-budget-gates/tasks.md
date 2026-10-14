# Tasks

## 1. Perf budgets and observers

- [x] 1.1 Add `src/perf/budgets.ts` with architecture defaults (`cpuThrottleRate` calibrated to 2, handler p95 2 ms, INP 100 ms, frame p95 16.7 ms, dropped ≤ 2%, loafEntriesMax 0) and unit test that exports match
- [x] 1.2 Replace 200 ms LoAF budget with `assertNoLoafEntries()`; remove `LOAF_BLOCKING_BUDGET_MS`; update `loafObserver` tests
- [x] 1.3 Add `framePacing.ts`, `eventTiming.ts`, `measureHandler.ts` with unit tests (mock rAF / PerformanceObserver / performance.measure)
- [x] 1.4 Expand `exposePerf.ts` / `__photobooksPerf` (clear, LoAF, INP, frame stats, measure/assert helpers); enable on DEV / `?perf=1` / `?loaf=1`; update `exposePerf` tests

## 2. Instrument photo open + React Compiler + headers

- [x] 2.1 Wrap photo open/load kickoff with `measureHandler` so import scenarios always record a measure; verify via unit or e2e later
- [x] 2.2 Add `oxc-transform-react` and enable `@vitejs/plugin-react` `compiler: true`; verify `pnpm build` succeeds
- [x] 2.3 Add `public/_headers` (COOP same-origin, COEP credentialless); mirror on Vite server/preview; after build assert `dist/_headers` contains both header names
- [x] 2.4 Update architecture.mdc, `openspec/config.yaml` quality bar, `react-perf-spa` skill, `docs/lessons.md` (60 fps rule); drop 200 ms wording

## 3. Playwright fixture, e2e, pnpm perf

- [x] 3.1 Add `e2e/perf/perfFixture.ts` (CDP throttle from budgets, scenario window, frame-stats attachment)
- [x] 3.2 Update photo-card e2e: `?perf=1`, click Open photo then setInputFiles, assert zero LoAF / INP / handler p95; assert `crossOriginIsolated`
- [x] 3.3 Add `pnpm perf` (Playwright with `PERF_HARD_FRAME_PACING=1`); document in `AGENTS.md`
- [x] 3.4 Upload frame-stats artifact from integration workflow (report-only)
- [x] 3.5 Tick nested `frame-budget-gates` checkboxes in `docs/roadmap.md` as each lands

## 4. Verification checklist

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff — N/A (stryker:diff only mutates pure `src/photo` helpers + `src/lib`; no mutable targets in this change)
- [x] pnpm test:lhci when UI or bundle size is affected
- [x] Agent docs: AGENTS.md module map + `pnpm perf` command; architecture.mdc + react-perf-spa updated
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] High-risk security surface: Cursor Security Review subagent before archive (pass: no medium+)

## Workflow follow-up

- Archive the change after implementation review and Security Review pass; sync delta specs into main `openspec/specs/`.
- Commit, push, open PR; tick top-level `frame-budget-gates` only after merge.
