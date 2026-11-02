## Implementation

- [x] 1. Move agents, command, skills and rules from `.cursor/` into `.claude/` (Claude frontmatter, in-body Cursor mentions rewritten, wrappers and symlinks gone); delete `.cursor/` and `.cursorignore`. Old-vs-new diff: bodies identical except Cursor mentions. Evidence: `git diff HEAD~1:.cursor/<f> HEAD:.claude/<f>` per file (frontmatter + Cursor lines only; skills 100% renames); `find .claude -type l` empty; `claude -p` probe lists the 3 agents, `/next-roadmap-item` and 5 skills.
- [x] 2. `CLAUDE.md` drops `.cursor/` imports and the SoT-in-`.cursor` rule; always-on rules load natively from `.claude/rules/` (probe). Evidence: `claude -p --model haiku` quoted git-finish / overview / architecture / testing headings and the "≤two failed local pushes" rule; path-scoped `data-model` / `design` not loaded.
- [x] 3. `quality/gates.json` budgets re-pathed to `.claude/` (old per-file budgets, total smaller); budget gate passes and lists every moved file. Evidence: `ts-rig-gate pr-policy --pr-body ''` lists only the 6 `.claude/` per-path raises (the gate reads them); with the Owner-brief line: OK. Sum 411→347 lines, 26020→23950 chars.
- [x] 4. Docs say Claude Code only: `AGENTS.md`, `README.md`, `docs/agent-loop.md`, `docs/design.md`, `openspec/config.yaml`, `openspec/specs/agent-context/spec.md`, backlog / roadmap mentions, `stryker.config.mjs` comment. Evidence: done-when `git grep` leaves only the item text and mouse-cursor lines; `pnpm check:fast` green; `pnpm roadmap check` ok.

## Manual test scenarios

N/A (no UI; agent config and docs only).
