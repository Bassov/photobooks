# Photobooks — Claude Code entry

@AGENTS.md
@.cursor/rules/overview.mdc
@.cursor/rules/architecture.mdc
@.cursor/rules/testing.mdc
@.cursor/rules/git-finish.mdc

## Claude Code deltas

- SoT stays in `.cursor/` (rules, skills, agents, command). `.claude/` holds thin wrappers and symlinks only; never copy text into them.
- `git-finish.mdc` precedence applies here too: an agreed task authorizes commit + PR.
- Reviewers / manual QA: Task with subagent `openspec-planning-reviewer`, `openspec-implementation-reviewer` or `manual-qa`; pass the brief path only.
- Long commands (`check:fast`, B, `ci-wait`) run in the foreground with an explicit Bash timeout (max 60 min). Headless: no TodoWrite.
