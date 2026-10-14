# Tasks

## 1. Budget mandates

- [x] 1.1 Add the size budget and split-before-apply rule to `openspec/config.yaml` `rules.proposal` and the 8-task limit to `rules.tasks`; verify `openspec instructions proposal` and `openspec instructions tasks` output both
- [x] 1.2 Point check 5 in `.cursor/agents/openspec-proposal-reviewer.md` at the `rules.proposal` budget; verify the file names the one-subsystem and 8-task limits by reference

## 2. Roadmap rules

- [x] 2.1 Extend `docs/roadmap.md` "How to use" with the subsystem definition, slicing rules, the `[contingency]` tag and its closing rule, and a pointer to the config budget; verify no numeric limits are duplicated there

## 3. Re-slice

- [x] 3.1 Re-slice M1–M2 per the design map; verify every original nested bullet appears under exactly one new item
- [x] 3.2 Re-slice M3–M4 per the design map and drop the duplicated OPFS-thumbnail bullet; verify bullet coverage as in 3.1
- [x] 3.3 Re-slice M5–M7 per the design map and add the M8 `**Re-plan:**` line; verify bullet coverage as in 3.1
- [x] 3.4 Point the LOD and PDF-memory fallbacks in `docs/future-architecture.md` at `far-zoom-lod` and `pdf-streaming`; verify every roadmap change name referenced there exists in `docs/roadmap.md`

## 4. Integration

- [x] 4.1 Run `openspec validate roadmap-change-sizing`, `prettier --check` on touched files and `pnpm verify:fast`; verify all green

## Verification checklist

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify) — N/A: docs/config only, no UI/runtime change
- [x] pnpm stryker:diff — N/A: no production modules changed
- [x] pnpm test:lhci when UI or bundle size is affected — N/A: docs/config only
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass — N/A: no UI in scope
- [x] Agent docs: if module map / commands / security surface / durable conventions changed → update AGENTS.md (≤150 lines); update .cursor/rules or skills only when a lasting convention changed; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A: no deps, not security-tagged
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] High-risk security surface: Cursor Security Review subagent before archive — N/A: docs/config only

## Workflow follow-up

- Archive after implementation review pass; sync the delta into `openspec/specs/agent-context/`.
- Commit, push and open a PR from `docs/roadmap-change-sizing` into `feat/editor-shell-filmstrip` (stacked on PR #19).
