# Photobooks — Claude Code entry

@AGENTS.md

## Claude Code

- Always-on rules load from `.claude/rules/` (no frontmatter); `data-model` / `design` are path-scoped. Agents, the `/next-roadmap-item` command and skills live in `.claude/` too.
- `git-finish.md` precedence: an agreed task authorizes commit + PR.
- Reviewers / manual QA: Task with subagent `openspec-planning-reviewer`, `openspec-implementation-reviewer` or `manual-qa`; pass the brief path only.
- Long commands (`check:fast`, B, `ci-wait`) run in the foreground with an explicit Bash timeout (max 60 min). Headless: no TodoWrite.
