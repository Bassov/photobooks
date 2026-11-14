## Implementation

- [x] 1. `scripts/perf-lane.mjs scope` returns 1 with a stderr error when git cannot diff against the base; unit tests (no merge base, bad ref, in/out of scope) in `scripts/perf-lane.test.mjs` (`scope (CLI in a git repo)`).
- [x] 2. `perf.yml` path filter: full base fetch, scope output captured so a failing script fails the step.
- [x] 3. `integration.yml` burn-in targets: full base fetch (same `--depth=1` bug).

## Manual test scenarios

N/A (CI only, no UI). Evidence: this PR's perf job scope log line, quoted in the PR body.
