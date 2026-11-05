## Implementation

- [x] 1. `scripts/unit-changed.mjs` + test: merge-base → `vitest run --changed`, thresholds 0, `FC_NUM_RUNS=25` default, `UNIT_CHANGED_BASE`, full-run fallback, exit passthrough (`scripts/unit-changed.test.mjs`, 19 tests).
- [x] 2. `scripts/vitest.setup.mjs`: `fc.configureGlobal` from `localFcNumRuns(env)` (no override under `CI`; probe: 25 runs locally, 100 with `CI=true`).
- [x] 3. `quality/gates.json` `checks.fast` unit → `node scripts/unit-changed.mjs`; `checks.core` unchanged.
- [x] 4. `package.json` `lint`: `--cache --cache-strategy content --cache-location .cache/eslint/` (cold 108 s, warm 5 s).
- [x] 5. `docs/roadmap/RULES.md` push-stop rule + `AGENTS.md` `check:fast` row.

## Manual test scenarios

N/A (local test tooling and docs; no UI). Done-when evidence (timed pushes, `uikit/`-only run) goes in the PR body.
