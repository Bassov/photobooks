## Decisions

1. **Nightly cause = one test.** The dry run fails on the `SpreadPager` resize test: React may run a component before bailing out of a same-state update; the React Compiler memo hides that call, Stryker-instrumented code has no memo. The test counts commits of a child instead.
2. **Shard the nightly.** 552 files / 51k mutants would pass the 6 h job cap. `scripts/stryker-shards.mjs`: 8 shards by `src/` dir (flat `src/editor/` by first letter); the last is the catch-all (base includes minus the others). `STRYKER_SHARD` narrows `config.mutate`; matrix `timeout-minutes: 300`.
3. **Merge + break once.** `scripts/stryker-merge.mjs` unions shard reports; fails on a missing shard, a duplicate file or score < `stryker.thresholds.break`; worst 20 files go to the job summary.
4. **Diff dry run:** `dryRunTimeoutMinutes: 20` (CI pass 4m05s vs 5-min default). No tests dropped; overhead, not PBT, dominates.
5. Benchmarks + long PBT get their own job.

## Touch-set & Test Plan

| Path                                 | Why                                                            |
| ------------------------------------ | -------------------------------------------------------------- |
| `stryker.config.mjs`                 | gate config: dry-run timeout; shard hook defers break to merge |
| `.github/workflows/stryker-full.yml` | shard matrix, merge, long-runs                                 |
| `scripts/stryker-shards.mjs`         | shard table                                                    |
| `scripts/stryker-merge.mjs`          | merge, score, break                                            |
| `src/render/SpreadPager.test.tsx`    | commit-count probe                                             |

- Reuse: `loadGates`; the existing summary step runs on the merged report.
- Tests: `scripts/stryker-shards.test.mjs` (mutate set covered exactly once), `scripts/stryker-merge.test.mjs`; CI `workflow_dispatch` run.
