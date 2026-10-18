# Tasks

## 1. Config rules

- [x] 1.1 Add Necessary-minimum bullets to `openspec/config.yaml` quality bar (artifact slimness, reuse ladder, bug-fix root-once, moved-code keeps validation/data-loss/security/a11y/perf) and an explicit test exemption (coverage/mutation/PBT/e2e geometry bars unchanged or stricter); verify by grepping the new phrases in the file
- [x] 1.2 Add matching necessary-minimum bullets under `rules.proposal` and `rules.design` (N/A in one line; `design.md` only for real decisions; no padded sections); verify phrases appear under those keys

## 2. Reviewer briefs

- [x] 2.1 Update `.cursor/agents/openspec-proposal-reviewer.md` Checks to flag scope beyond the item, unrequested options/abstractions, padded sections, and plans that re-implement helpers vs the reuse ladder; state tests are exempt / never flag tests as excessive; verify by reading the Checks section
- [x] 2.2 Update `.cursor/agents/openspec-design-reviewer.md` Checks likewise plus re-implemented helpers vs reuse ladder; test exemption; verify by reading the Checks section
- [x] 2.3 Update `.cursor/agents/openspec-implementation-reviewer.md` Checks likewise for the diff; never flag thorough tests as excessive; verify by reading the Checks section

## 3. Roadmap follow-up (owner-requested, do not implement)

- [x] 3.1 Add M2.2 product item `spread-thumb-render-scope` via `pnpm roadmap add` (append at end of M2.2) and write `docs/roadmap/M2.2/spread-thumb-render-scope.md` with the owner-supplied content; verify `pnpm roadmap show spread-thumb-render-scope` and `pnpm roadmap check`

## Verification

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below) — evidenced 2026-10-18: roadmap/git-test-isolation/mutation-scope/deps/knip/unit/typecheck/lint all OK
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it — N/A (docs/rules only)
- [x] pnpm stryker:diff — N/A (no production `src/` changes)
- [x] pnpm test:lhci when UI or bundle size is affected — N/A
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass — N/A
- [x] Docs/rules sync: no README/AGENTS/alwaysApply/future-architecture drift; roadmap follow-up via `pnpm roadmap add`; lesson `docs/lessons/2026-10-18-necessary-minimum-reviewer-parity.md` for [repeat] brief/artifact parity
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A
- [x] Launch openspec-design-reviewer was pass before apply (evidenced) — Verdict: pass, no findings
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive — Verdict: pass (none)
- [x] Manual check (after implementation review pass, before archive): N/A — docs/rules only; see Manual test scenarios
- [x] Security Review: Cursor Security Review subagent before archive when the item is tagged (Security Review: …) or the change touches the security surface — N/A

## Manual test scenarios

N/A — docs/rules only; no UI.
