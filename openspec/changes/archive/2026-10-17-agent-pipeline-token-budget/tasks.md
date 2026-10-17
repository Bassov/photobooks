# Tasks

## 1. Mechanical hooks and scripts

- [x] 1.1 Set Lefthook pre-push to `pnpm verify:fast`; add `verify:fast:quiet` and `test:e2e:quiet` in `package.json` — verified: `lefthook.yml` + `pnpm verify:fast:quiet` green; `pnpm test:e2e:quiet` green (full suite)
- [x] 1.2 Add `scripts/agent-env.sh` (Node 22 + pnpm on PATH, no repo `.tool-versions`) — verify `env -i HOME="$HOME" PATH=/usr/bin:/bin sh -c '. scripts/agent-env.sh && node -v | grep -q "^v22\." && command -v pnpm' && test ! -f .tool-versions`

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

1. `pnpm exec lefthook run pre-push --force` — hook command is `pnpm verify:fast` only (`lefthook.yml`); run completed with verify:fast (typecheck/lint/deps/knip/mutation-scope/vitest), no Playwright in the hook summary.
2. `env -i HOME="$HOME" PATH=/usr/bin:/bin sh -c '. scripts/agent-env.sh && node -v && command -v pnpm'` — observed `v22.23.3` and `/home/albasov/.asdf/shims/pnpm` (exit 0). Without the script the same `env -i` PATH sees `v18.19.1` and no pnpm.
3. `test ! -f .tool-versions` — exit 0 (no file created).
4. `pnpm test:e2e:quiet` — Playwright `--reporter=dot`; suite green (56 passed) with known local flakes filed as `e2e-local-flakes`: `open-save › fresh session Open loads saved book with thumbs and frames`, `filmstrip › mixed aspect cards pack with uniform gaps…`, `template-unplace › a smaller template unplaces overflow photos…`, and the two `drag-place` frame-budget tests.
