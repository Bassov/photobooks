# e2e-coverage-per-worker

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item e2e-coverage-per-worker

## Scope

Owner 2026-11-20: e2e must fit the ≤10 min CI budget. `e2e/fixtures/coverage.ts` writes `window.__coverage__` (~7.6 MB JSON) to `.nyc_output/` after every test (~65 s per shard in #652).

- [ ] Merge each test's Istanbul coverage in worker memory (sum s/f/b hit counters per file) and write one `.nyc_output/e2e-worker-*.json` per worker in a worker-scoped auto fixture teardown; no per-test `JSON.stringify` / file write.
- [ ] Merge helper has unit tests; no new dependencies; specs keep importing `test` from `e2e/fixtures/coverage` unchanged.
- [ ] `pnpm coverage:e2e` accepts the per-worker files unchanged (a needed rig change = separate item).

**Done when:** `pnpm coverage:e2e` totals (lines/branches/functions/statements) on a local subset of ≥30 specs equal before/after (±0.1 pp); `.nyc_output` file count on that subset = number of workers; per-test fixture overhead before/after (ms per test) and CI `integration` job time vs a recent main run in the PR body; no coverage gate loosened.

- **Browser check:** none (CI tooling; no UI)
