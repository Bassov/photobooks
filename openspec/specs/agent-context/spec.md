# agent-context (architecture pointer)

Agent / OpenSpec pipeline **behavior is owned by scripts and Cursor config**, not this file.

| Concern                                                 | Source of truth                                    |
| ------------------------------------------------------- | -------------------------------------------------- |
| Per-change mandates                                     | `openspec/config.yaml`                             |
| Agent CLI (preflight / finish / archive / instructions) | `scripts/agent.mjs`, `scripts/openspec-native.mjs` |
| Navigation map                                          | `AGENTS.md`                                        |
| Finish / PR / no CI watch                               | `.cursor/rules/git-finish.mdc`                     |
| Verify / flake                                          | `.cursor/rules/testing.mdc`                        |
| Unattended pipeline                                     | `.cursor/commands/next-roadmap-item.md`            |
| Reviewers                                               | `.cursor/agents/openspec-*-reviewer.md`            |
| Rule-file budgets                                       | `quality/gates.json` `agentRules.budgets`          |

Changes to `.cursor/**` or agent scripts: set `skip_specs: true` — do not grow Gherkin mirrors here.
