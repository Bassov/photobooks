# lint-autofix-hook

Tag: lite
Milestone: P3
Title: Bug: /next-roadmap-item lint-autofix-hook

Process item (Owner 2026-11-15, worker-efficiency item 1 of 4; kind cfix, lane process). Why: workers lose ~115 calls per 7 d on lint/format failures (pre-commit 47, check:fast 30, eslint 25, typecheck 13), each a fix edit plus a rerun. Quality must not drop: every check stays; only avoidable failures stop costing calls.

## Scope

- [x] Claude Code PostToolUse hook on `Edit|MultiEdit|Write` runs `scripts/claude-hooks/lint-autofix.mjs`: reads the hook JSON from stdin, takes `tool_input.file_path`, and for an in-repo JS/TS/CSS/MD/JSON file runs prettier then `eslint --fix --cache` on that ONE file with local packages (no npx). It replaces the inline prettier-only hook in `.claude/settings.json`, which headless workers load beside `.claude/settings.headless.json` (one hook, not two).
- [x] Never fails the tool call: exit 0, errors swallowed, hard 9 s cap (hook timeout 10 s); silent on success, one `additionalContext` line when eslint errors remain after `--fix`.
- [x] Skips files outside the repo, `node_modules`, files ignored by `.gitignore` / `.prettierignore` / eslint ignores, other extensions.
- [x] Script test: non-repo path skipped, ignored file skipped, exit 0 on an eslint error and on a broken eslint config.
- Removes: the inline `node -e` prettier hook in `.claude/settings.json`.
- Hard nos: no `package.json`, `eslint.config.js`, `docs/agent-loop.md`, `src/`, `e2e/`, `uikit/`, CI changes; no new dependency. The agent-loop hygiene line is a separate item (PR body only here).
- **Done when:** a badly formatted .ts edit is reformatted by the hook (before/after diff in the PR body); hook wall time on a typical src file ≤3 s warm (measured in the PR body); the script test is green. Target metric (loop, after merge): lint/format failures on commit/check:fast ≤10 per 50 runs.
- **Browser check:** N/A (agent tooling; no product code).
