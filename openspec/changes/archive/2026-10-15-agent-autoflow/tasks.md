## 1. Orchestrator command

- [x] 1.1 Add `.cursor/commands/next-roadmap-item.md` per #56 (preflight, item pick, OpenSpec CLI planning + reviewers, `/opsx-apply`, `/opsx-archive` Sync now, git-finish + CI wait; stop conditions including security-tagged items)

## 2. Config mandates

- [x] 2.1 Update `openspec/config.yaml`: proposal Browser/Perf rule; tasks validate --strict; Verification Manual check + Docs/rules sync; apply stryker+coverage triage and Manual check after impl review; archive Manual/Docs gates, drift grep, roadmap tick; lessons `[repeat]` / `[lesson]`

## 3. Reviewers

- [x] 3.1 Update `openspec-implementation-reviewer.md` (survivor reasons in tasks.md; Docs/rules sync; `[lesson]` / `[repeat]` tags) and design-reviewer Inputs to include `tasks.md`

## 4. PR finish

- [x] 4.1 Update `git-finish.mdc` (fill every PR template section; Manual test scenarios from tasks.md; Wait for green with `gh pr checks --watch`, max 3 fix rounds) and `.github/PULL_REQUEST_TEMPLATE.md` (Docs/rules updated + Manual test scenarios)

## 5. Roadmap policy + backfill

- [x] 5.1 Update `docs/roadmap.md` tick policy; add Perf/Browser lines for `filmstrip-file-name`, `template-unplace-notice`, `add-spread-camera`; annotate M1 asset worker pool drift

## 6. Drift cleanup + nav

- [x] 6.1 Fix #49 drift in `testing.mdc`, `README.md`, `docs/future-architecture.md`; add `/next-roadmap-item` nav line to `AGENTS.md` (≤150 lines)

## Verification checklist

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify) — N/A docs/agent-pipeline only; `pnpm verify:fast` instead
- [x] pnpm stryker:diff — N/A no production modules
- [x] pnpm test:lhci when UI or bundle size is affected — N/A
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass — N/A non-UI
- [x] Docs/rules sync: if behavior, commands, CI output, module map or the roadmap item changed → update README.md, AGENTS.md (≤150 lines), affected .cursor/rules/*.mdc and skills, docs/future-architecture.md notes, and annotate docs/roadmap.md where the shipped scope deviates; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] Manual check (after implementation review pass, before archive): drive `pnpm dev` in the browser through the roadmap item's Browser check (or the spec scenarios for [prep]); record numbered steps and observed results under `## Manual test scenarios` at the end of this file (N/A for non-UI); a bug found → Playwright test + fix + re-run implementation review on the delta
- [x] High-risk security surface: Cursor Security Review subagent before archive — N/A docs/agent pipeline; security-tagged unattended stop-and-ask deferred

## Manual test scenarios

N/A — non-UI agent-pipeline / docs change.
