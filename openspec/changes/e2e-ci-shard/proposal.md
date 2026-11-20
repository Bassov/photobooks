## Proposal

Roadmap: `docs/roadmap/P3/e2e-ci-shard.md` (scope / Done when).

### Scope out

- e2e spec content, `src/**`, `uikit/**`, gate thresholds, other workflows.
- Branch protection (Owner updates it from the PR body).

### Delta / Risk

- Checks become `e2e (i/10)` + `e2e-report`; `integration` unchanged. Success: `integration` green, `verify` confirms every listed file ran.
- 2 workers per shard is new; unstable tests are fixed, not skipped.
