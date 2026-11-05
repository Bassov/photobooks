## Implementation

- [ ] 1. `scripts/unit-changed.mjs` + test: merge-base → `vitest run --changed`, thresholds 0, `FC_NUM_RUNS=25` default, full-run fallback, exit passthrough.
- [ ] 2. `scripts/vitest.setup.mjs`: `fc.configureGlobal` from `localFcNumRuns(env)` (no override under `CI`).
- [ ] 3. `quality/gates.json` `checks.fast` unit → `node scripts/unit-changed.mjs`; `checks.core` unchanged.
- [ ] 4. `docs/roadmap/RULES.md` push-stop rule + `AGENTS.md` `check:fast` row.

## Manual test scenarios

N/A (local test tooling and docs; no UI). Done-when evidence (timed pushes, `uikit/`-only run) goes in the PR body.
