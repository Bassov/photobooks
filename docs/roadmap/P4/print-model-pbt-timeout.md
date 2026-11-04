# print-model-pbt-timeout

Tag: feature
Milestone: P4
Title: Bug: print-model PBT times out in loaded pre-push runs
Status: done

## Scope

- [x] `src/core/printModel.pbt.test.ts > migrate is idempotent and parses as the current shape` (from #454) no longer times out at 5000 ms in the loaded pre-push unit run (seen 3× on 2026-11-04, e.g. seed=1924742319): find why one run is slow (arbitrary size, runs, migrate/parse cost, clones) and make the test cheaper, or fix the slow path in `src/core/migrate.ts` / `schema.ts`; same fix for other `*.pbt.test.ts` on the same path
- **Done when:** the test's own vitest time ≤1000 ms locally (before/after over 5 runs); same properties and numRuns; an injected migrate idempotence bug is still caught; test timeout not raised
- **Browser check:** n/a (no UI)
- **Test:** unit + PBT in `src/core`; no e2e
- **Hard nos:** no edits in `uikit/`, `src/editor/`, `src/site/`
- **Depends:** print-model-schema
