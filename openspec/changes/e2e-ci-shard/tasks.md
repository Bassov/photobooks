## Implementation

- [x] 1. Measure per-spec durations from run 44773461133's `e2e-results` (table in the PR body); record them in `scripts/e2e-shard-durations.json`.
- [x] 2. `scripts/e2e-shard.mjs` pick / verify / record with unit tests (`scripts/e2e-shard.test.mjs`).
- [x] 3. `integration.yml`: 10-shard `e2e` matrix (2 workers, blob reports, per-shard nyc merge) and `e2e-report` (merge reports, verify, coverage + Codecov, artifacts); `integration` and ci-comment need `e2e-report`.
- [x] 4. Atomic write of the large JPEG fixture.

## Manual test scenarios

N/A (CI-only change, no UI). The PR's own integration run and CI report comment are the check.
