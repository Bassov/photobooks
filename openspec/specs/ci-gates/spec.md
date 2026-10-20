# ci-gates (architecture pointer)

CI / quality-gate **behavior is owned by executable config**, not this file.

| Concern                            | Source of truth                                                      |
| ---------------------------------- | -------------------------------------------------------------------- |
| Thresholds, required jobs, budgets | `quality/gates.json`                                                 |
| Gate ratchet / weakening           | `scripts/check-gate-ratchet.mjs`, `scripts/check-test-weakening.mjs` |
| Unified local CI                   | `pnpm check` → `scripts/check.mjs`                                   |
| Workflows                          | `.github/workflows/*.yml`                                            |
| Codecov                            | `codecov.yml`                                                        |
| Mutation                           | `stryker.config.mjs`                                                 |

Changes to scripts, workflows, or gate JSON: set `skip_specs: true` — do not grow Gherkin mirrors here.
