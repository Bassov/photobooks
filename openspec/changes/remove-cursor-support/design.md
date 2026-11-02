## Decisions

1. `git mv` every `.cursor/` SoT file onto its `.claude/` path (history follows the text): 3 agents → `.claude/agents/*.md` (Claude frontmatter `name/description/tools/model` from the wrapper; wrapper-only lines kept), command → `.claude/commands/next-roadmap-item.md` (wrapper frontmatter + `$ARGUMENTS` line + body), 5 skills → `.claude/skills/*/` (symlinks deleted), 6 rules `.mdc` → `.claude/rules/*.md`. In-body `.cursor` / Cursor mentions are rewritten.
2. The 4 `alwaysApply` rules carry no frontmatter, so Claude Code loads them natively from `.claude/rules/`; `CLAUDE.md` drops its `@.cursor/rules/*` imports (no double load). `data-model` / `design` keep the wrapper's `paths:`. Proven by a `claude -p` probe; fallback: `CLAUDE.md` imports.
3. `quality/gates.json`: drop the 10 `.cursor/` rows; each `.claude/` file that took over a text gets that file's old budget unchanged (never more); new rule paths get the old `.mdc` budgets. The rig already scopes `.claude/(agents|commands|rules)/*.md`.
4. Delete `.cursor/cli.json` (Cursor-only permissions; Claude uses `.claude/settings*.json`) and `.cursorignore` (the runner already says ignore the archive).
5. `stryker.config.mjs` keeps ignoring `.claude` (nothing to mutate); the symlink rationale goes.
6. `openspec/specs/agent-context/spec.md` (a pointer table) is edited directly; no delta (`skip_specs`).

## Touch-set & Test Plan

- Files: `.cursor/**`, `.cursorignore`, `.claude/{agents,commands,rules,skills}/**`, `CLAUDE.md`, `AGENTS.md`, `README.md`, `docs/agent-loop.md`, `docs/design.md`, `docs/backlog/*.md`, `docs/roadmap/DEFERRED.md`, `docs/roadmap/P2/worker-ctx-trim.md`, `openspec/config.yaml`, `openspec/specs/agent-context/spec.md`, `stryker.config.mjs`.
- Gate config: `quality/gates.json` (decision 3).
- Evidence: old-vs-new diff (bodies identical except Cursor mentions), `find .claude -type l` empty, rules-load probe, `pnpm check:integrity`, `pnpm agent instructions`, `pnpm roadmap check`, `pnpm check:fast`.
