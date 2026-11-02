## Implementation

- [ ] 1. Move agents, command, skills and rules from `.cursor/` into `.claude/` (Claude frontmatter, in-body Cursor mentions rewritten, wrappers and symlinks gone); delete `.cursor/` and `.cursorignore`. Old-vs-new diff: bodies identical except Cursor mentions.
- [ ] 2. `CLAUDE.md` drops `.cursor/` imports and the SoT-in-`.cursor` rule; always-on rules load natively from `.claude/rules/` (probe).
- [ ] 3. `quality/gates.json` budgets re-pathed to `.claude/` (old per-file budgets, total smaller); budget gate passes and lists every moved file.
- [ ] 4. Docs say Claude Code only: `AGENTS.md`, `README.md`, `docs/agent-loop.md`, `docs/design.md`, `openspec/config.yaml`, `openspec/specs/agent-context/spec.md`, backlog / roadmap mentions, `stryker.config.mjs` comment.

## Manual test scenarios

N/A (no UI; agent config and docs only).
