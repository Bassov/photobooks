## Implementation

- [x] 1. `scripts/perf-baseline.mjs`: `scenarioSources`, `touchesScenario`, `classify`, `readBaseVerdict`.
- [x] 2. `scripts/perf-lane.mjs`: `collectScenarios` adds the spec path; `judge` returns red scenarios; `verdict` takes `--base`, `--base-url`, `--base-ref`, `--out` and writes forgiven scenarios to the step summary.
- [x] 3. `.github/workflows/perf.yml`: push run uploads `perf-verdict`; PR run downloads the base verdict and passes it to `verdict`; `actions: read`.
- [x] 4. `scripts/perf-baseline.test.mjs`: 4 decision cases, verdict file round trip, dry-run fixture showing "pre-existing on main" in the step summary.
- [x] 5. `docs/agent-loop.md`: one sentence on the pre-existing rule.

## Manual test scenarios

N/A (no UI). Dry run: `node scripts/perf-lane.mjs verdict --base … --base-url … --base-ref HEAD …` with fixture reports; output pasted in the PR body.
