# agent-context (architecture pointer)

Agent / OpenSpec pipeline **behavior is owned by the harness package and Cursor config**, not this file.

| Concern                                                 | Source of truth                           |
| ------------------------------------------------------- | ----------------------------------------- |
| Per-change mandates                                     | `openspec/config.yaml`                    |
| Agent CLI (preflight / finish / archive / instructions) | `@albasov/ts-agent-rig` (`pnpm agent`)    |
| Navigation map                                          | `AGENTS.md`                               |
| Finish / PR / no CI watch                               | `.cursor/rules/git-finish.mdc`            |
| Verify / flake                                          | `.cursor/rules/testing.mdc`               |
| Unattended pipeline                                     | `.cursor/commands/next-roadmap-item.md`   |
| Reviewers                                               | `.cursor/agents/openspec-*-reviewer.md`   |
| Rule-file budgets                                       | `quality/gates.json` `agentRules.budgets` |

Changes to `.cursor/**` or agent harness pins: set `skip_specs: true` — do not grow Gherkin mirrors here.
