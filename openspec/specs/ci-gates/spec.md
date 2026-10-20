# ci-gates (architecture pointer)

CI / quality-gate **behavior is owned by executable config**, not this file.

| Concern                            | Source of truth                                           |
| ---------------------------------- | --------------------------------------------------------- |
| Thresholds, required jobs, budgets | `quality/gates.json`                                      |
| Gate ratchet / weakening           | `@albasov/ts-agent-rig` (`ts-rig-gate pr-policy`, …)      |
| Unified local CI                   | `pnpm check` → `ts-rig-check`                             |
| Workflows                          | `.github/workflows/*.yml` (reusable Actions from the rig) |
| Codecov                            | `codecov.yml`                                             |
| Mutation                           | `stryker.config.mjs`                                      |

Changes to scripts, workflows, or gate JSON: set `skip_specs: true` — do not grow Gherkin mirrors here.
