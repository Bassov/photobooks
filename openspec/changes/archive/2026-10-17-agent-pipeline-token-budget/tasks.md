# Tasks

## 1. Mechanical hooks and scripts

- [x] 1.1 Set Lefthook pre-push to `pnpm verify:fast`; add `verify:fast:quiet` and `test:e2e:quiet` in `package.json` — verified: `lefthook.yml` + `pnpm verify:fast:quiet` green; `pnpm test:e2e:quiet` green (full suite)
- [x] 1.2 Add `scripts/agent-env.sh` (Node 22 + pnpm on PATH, no repo `.tool-versions`) — verify `bash -c 'source scripts/agent-env.sh && pnpm -v && node -v'` and `test ! -f .tool-versions`

## 2. Agent docs and reviewers

- [x] 2.1 Update `.cursor/commands/next-roadmap-item.md`, `docs/roadmap/RULES.md`, and `.cursor/rules/git-finish.mdc` for token hygiene, out-of-scope/≤2 pushes, quiet CI, re-review, PR-once — verify by grepping those phrases
- [x] 2.2 Rewrite Inputs on the three `.cursor/agents/openspec-*-reviewer.md` for parent briefs; implementation prefers evidence over full e2e re-run — verify brief wording present and no “open full config.yaml” mandate
- [x] 2.3 Update `AGENTS.md` (≤150 lines) and `README.md` Lefthook line for agent-env, quiet scripts, pre-push `verify:fast` — verify `wc -l AGENTS.md` and README text

## 3. Spec sync and roadmap ticks

- [x] 3.1 Keep delta `specs/agent-context/spec.md` aligned with shipped behavior; `openspec validate agent-pipeline-token-budget --strict` green — verify validate exit 0
- [x] 3.2 Tick matching scope checkboxes in `docs/roadmap/M2.1/agent-pipeline-token-budget.md` with targeted edits as work lands — verify boxes match shipped files

## Verification

- [x] pnpm typecheck — green via `pnpm verify:fast:quiet`
- [x] pnpm lint — green via `pnpm verify:fast:quiet`
- [x] pnpm test — green via `pnpm verify:fast:quiet` (84 files / 776 tests)
- [x] pnpm test:e2e (or pnpm verify) — `pnpm test:e2e:quiet` green (script smoke + suite); pre-push remains `verify:fast`; Playwright stays CI gate
- [x] pnpm stryker:diff — No mutable src files changed vs origin/main; skipping Stryker
- [x] pnpm test:lhci when UI or bundle size is affected — N/A (non-UI)
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass — N/A (non-UI prep)
- [x] Docs/rules sync: README Lefthook + quiet scripts; AGENTS.md (80 lines) agent-env; git-finish; testing.mdc aligned with verify:fast pre-push; next-roadmap-item; three reviewers; RULES.md Agent apply hygiene; roadmap item scope ticked; future-architecture unchanged
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A (scripts only; lockfile unchanged)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced) — pass (no findings)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive — pass after e2e:quiet evidence + testing.mdc sync (prior high/medium fixed)
- [x] Manual check (after implementation review pass, before archive): N/A for non-UI prep — recorded under Manual test scenarios
- [x] Security Review: Cursor Security Review subagent before archive when the item is tagged (Security Review: …) or the change touches the security surface — N/A (docs/hooks/scripts; not security-tagged)

## Manual test scenarios

N/A — non-UI `[prep]` (docs/hooks/scripts only). Spec scenarios validated via file presence, `openspec validate --strict`, `source scripts/agent-env.sh`, and `pnpm verify:fast:quiet`.
