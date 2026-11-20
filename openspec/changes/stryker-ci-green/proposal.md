## Proposal

Roadmap: `docs/roadmap/P5/stryker-ci-green.md` (scope / Done when SoT).

### Scope out

- `quality/gates.json` thresholds, mutate excludes, the stryker-diff pass/fail rule.
- `integration.yml`, e2e, flaky unit tests of other lanes; raising survivors in the worst files (orch adds items).

### Delta / Risk

- No spec delta: CI and test-only change, no `src/` behaviour.
- Shards run with `break: null`; break 60 applies once to the merged full score, the same rule the single job had.
