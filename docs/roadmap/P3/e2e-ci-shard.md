# e2e-ci-shard

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item e2e-ci-shard
Status: done

## Scope

Owner 2026-11-20: shard the integration workflow's e2e so a PR's run finishes in ≤10 min wall clock (first job start → `integration` done). Today the single `e2e` job runs the functional lane with `workers: 1` for ~1h40m (1032 tests, 207 files, 5841 s of test time).

- [x] Measure per-spec durations from a green run's `e2e-results` artifact (top 15 + total, test time vs setup) and put the table in the PR body.
- [x] Functional e2e as a matrix of duration-balanced shards (whole spec files, recorded durations, 2 workers each) plus an `e2e-report` job that merges blob reports into the `e2e-results` / `playwright-report` artifacts, checks every listed spec file ran, and merges the shards' coverage before the Codecov upload.
- [x] Same specs, retries, coverage; burn-in and @flaky jobs unchanged. `integration` keeps its name and `needs:` the shards + `e2e-report` with the same pass/fail logic; ci-comment reads the merged report.
- [x] Shard-unsafe fixture: the large JPEG is written atomically (two workers on one runner).
- **Done when:** the PR's integration run is green on every shard with ≤10 min from first job start to `integration` done (≤12 min with a measured explanation); PR body has before/after (total wall, longest shard, setup per shard, N, workers, runner-minutes) and names the changed check names.
- **Browser check:** none (CI-only change); the PR's own integration run and its CI report comment are the check.
- **UI kit:** none (no matching component)

## Done note

Review round 1 (PR #652): the reader-gl specs time out with two workers on one runner, so they run on 1-worker shards split by spec location (`file:line`); other files stay whole on 2-worker shards. 15 shards (3 × 1 worker + 12 × 2 workers), durations recorded per location. The report merge moved into the `integration` job itself (no separate `e2e-report` job), which saves one runner queue wait; `integration` still fails on any shard failure, a missing file or a failed coverage upload.
