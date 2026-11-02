# agent-context (architecture pointer)

Agent / OpenSpec pipeline **behavior is owned by the harness package and agent config (`.claude/`, `CLAUDE.md`)**, not this file.

| Concern                                                 | Source of truth                           |
| ------------------------------------------------------- | ----------------------------------------- |
| Agent loop procedure (stages, A/B/C, stamp, finish)     | `docs/agent-loop.md`                      |
| Per-change artifact mandates (proposal/design/tasks)    | `openspec/config.yaml`                    |
| Agent CLI (preflight / finish / archive / instructions) | `@albasov/ts-agent-rig` (`pnpm agent`)    |
| Navigation map                                          | `AGENTS.md`                               |
| Finish / PR precedence                                  | `.claude/rules/git-finish.md`             |
| Verify / flake pointer                                  | `.claude/rules/testing.md`                |
| Unattended runner                                       | `.claude/commands/next-roadmap-item.md`   |
| Reviewers                                               | `.claude/agents/openspec-*-reviewer.md`   |
| Claude Code entry (only harness)                        | `CLAUDE.md`                               |
| Rule-file budgets                                       | `quality/gates.json` `agentRules.budgets` |

Changes to `.claude/**`, `CLAUDE.md` or agent harness pins: set `skip_specs: true` — do not grow Gherkin mirrors here.
