# ci-gates (architecture pointer)

CI / quality-gate **behavior is owned by executable config**, not this file.

| Concern                            | Source of truth                                                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Thresholds, required jobs, budgets | `quality/gates.json`                                                                                                                   |
| Gate ratchet / weakening           | `@albasov/ts-agent-rig` (`ts-rig-gate pr-policy`, …)                                                                                   |
| Fast local CI (A)                  | `pnpm check:fast` / `pnpm check` → `ts-rig-check` (afterUnit: patch-coverage only; no stryker)                                         |
| Integrity (C1)                     | `pnpm check:integrity` → inventory `integrity` (openspec-budget, codecov-yml, roadmap)                                                 |
| Mutation                           | CI `stryker-diff` workflow + agent B (`pnpm stryker:diff`); nightly full Stryker; not in check:fast. When B runs: `docs/agent-loop.md` |
| Workflows                          | `.github/workflows/*.yml` (reusable Actions from the rig)                                                                              |
| Codecov                            | `codecov.yml`                                                                                                                          |
| Mutation config                    | `stryker.config.mjs`; diff gate scores changed line ranges (`pnpm stryker:diff` / `@albasov/ts-agent-rig`)                             |

Changes to scripts, workflows, or gate JSON: set `skip_specs: true` — do not grow Gherkin mirrors here.
