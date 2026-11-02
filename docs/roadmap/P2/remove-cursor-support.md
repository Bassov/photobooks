# remove-cursor-support

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item remove-cursor-support
Status: done

Owner PLAN item 4 (2026-11-02): the repo drops Cursor IDE/CLI support; Claude Code is the only harness and loses nothing. Undo the Cursor↔Claude compat compromises (SoT in `.cursor/`, symlinks, thin wrappers, `.mdc` format, dual docs) so Claude reads one direct copy.

## Scope

- [ ] Agents, the `/next-roadmap-item` command, rules and skills live as real files in `.claude/` (plain `.md`, Cursor-only frontmatter dropped); `.cursor/` and `.cursorignore` are removed; no wrappers or symlinks remain.
- [ ] `quality/gates.json` agent-rule budgets point at the `.claude/` paths, and the budget gate still measures every moved file.
- [ ] Docs say Claude Code only: `AGENTS.md`, `README.md`, `CLAUDE.md`, `docs/agent-loop.md` `## Harnesses`, `openspec/config.yaml`, `openspec/specs/agent-context/`, backlog / roadmap mentions.
- Off limits: `src/`, `e2e/`, `uikit/`, the rig (`@albasov/ts-agent-rig`), mouse-cursor CSS / camera code.
- **Done when:** `git grep -n -i '\.cursor\|cursor-agent\|cursorignore\|cursor ide\|Cursor '` outside mouse-cursor code returns 0 lines or each hit is explained in the PR; `find .claude -type l` is empty; the command, 3 agents and 5 skills resolve from `.claude/`; `pnpm agent instructions` works; the agent-rules budget gate passes and counts the moved files; `pnpm roadmap check` passes; the PR body lists Removed / Simplified / external refs.
- **Browser check:** N/A (agent config and docs; no product code).
