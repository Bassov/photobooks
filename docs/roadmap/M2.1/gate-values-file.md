# gate-values-file

Tag: prep
Milestone: M2.1
Title: one data file for gate thresholds
Status: done

## Scope

- [x] `quality/gates.json` holds the gate values: Vitest coverage floors, Stryker nightly thresholds, LHCI assertion levels and scores, `budget.json` limits, Playwright CI retries. `vite.config.ts`, `stryker.config.mjs`, `lighthouserc.cjs` and `playwright.config.ts` read from it. `codecov.yml` stays its own static YAML
- [x] Also the phase-1 e2e values: the burn-in repeat count (`E2E_BURN_IN` from `e2e-burn-in`) and the `@flaky` list (`e2e/flaky.json` from `strict-e2e`, empty by then)
- [x] A static check (no config evaluation) that these configs take their values from `quality/gates.json` and hardcode none
- **Done when:** every gate value except Codecov's lives in `quality/gates.json`, and CI behaves exactly as before (same thresholds, same results).
- **Size:** ~400 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #72 K

## Done note

SoT quality/gates.json; stryker/lighthouse configs are .mjs; static gate-values check in pnpm check; values unchanged from main
