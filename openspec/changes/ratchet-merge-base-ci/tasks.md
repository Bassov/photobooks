## Implementation

- [x] 1. Rig PR Bassov/ts-agent-rig#12: `pr-policy.yml` fetches the full head and passes the merge-base as `--base-ref` (commit `d98239cc`).
- [x] 2. Rig test `merge-base base ref: spec added on base after fork is not test-file-deleted` + workflow asserts (3 passed, host config).
- [x] 3. `.github/workflows/pr-policy.yml` pins `@d98239ccaf974295addd2cc596aeb2cb6ca00943`.

## Manual test scenarios

N/A: CI workflow only, no UI. Proof is the first behind-main PR's pr-policy run after merge (see proposal).
