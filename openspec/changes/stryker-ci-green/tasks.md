## Implementation

- [x] 1. `SpreadPager` resize test counts commits of the spread, not `renderSpread` calls.
- [x] 2. `dryRunTimeoutMinutes: 20` in `stryker.config.mjs`.
- [x] 3. `scripts/stryker-shards.mjs` + `STRYKER_SHARD` hook + tests.
- [x] 4. `scripts/stryker-merge.mjs` + tests: merged report, full score, break, worst files.
- [x] 5. `stryker-full.yml`: shard matrix, merge job, long-runs job.

## Manual test scenarios

N/A — CI-only; evidence is the `workflow_dispatch` run of stryker-full and this PR's stryker-diff run.
