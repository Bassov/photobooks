# gate-values-file

Tag: prep
Milestone: M2.1
Title: one data file for gate thresholds

## Scope

- [ ] `quality/gates.json` holds the gate values: Vitest coverage floors, Stryker nightly thresholds, LHCI assertion levels and scores, `budget.json` limits, Playwright CI retries. `vite.config.ts`, `stryker.config.json` (or a `.mjs` wrapper), `lighthouserc.cjs` and `playwright.config.ts` read from it. `codecov.yml` stays its own static YAML
- [ ] A static check (no config evaluation) that these configs take their values from `quality/gates.json` and hardcode none
- **Done when:** every gate value except Codecov's lives in `quality/gates.json`, and CI behaves exactly as before (same thresholds, same results).
