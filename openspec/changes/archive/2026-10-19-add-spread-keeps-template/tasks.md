# Tasks

## 1. Core op

- [x] 1.1 Extend `addSpread` with optional `templateId` (validate via `isTemplateId`, default `'one-per-page'`); forward from `BookOp` `addSpread` in `applyBookOp`
- [x] 1.2 Unit cases in `ops.test.ts`: copy 4-grid; invalid id falls back; first/last page roles still reapplied; fast-check property that any valid template keeps invariants

## 2. UI wiring

- [x] 2.1 `Pasteboard` `onAddSpread` dispatches `{ type: 'addSpread', templateId }` from `getSpreadTemplateId(markedId)` (omit / one-per-page when null)
- [x] 2.2 Update `SpreadTemplateBar` radiogroup `aria-label` to state it applies to this spread; adjust tests that assert the label

## 3. Tests

- [x] 3.1 Pasteboard view tests: add-spread with active 4-grid (or 2-up) yields matching frame count / template on the new spread
- [x] 3.2 e2e regression (template-unplace or spread-view): 4-grid → Add spread → four placeholders + radio stays 4-grid; scroll back to spread 1 still 4-grid; keep existing reveal/`assertDocumentFitsViewport` assertions

## 4. Verification

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below)
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected — N/A (label/op wiring only; no bundle-size surface)
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass — ui-review: a11y (radiogroup "Template for this spread", keyboard radios, Add spread); states (disabled when no marked spread); layout smoke via e2e empty/happy/scroll (`assertDocumentFitsViewport`); no anti-slop issues on editor chrome
- [x] Docs/rules sync: if behavior, commands, CI output, module map or the roadmap item changed → update README.md, AGENTS.md (within agentRules.budgets), affected .cursor/rules/*.mdc and skills, docs/future-architecture.md notes, and annotate the roadmap item file (or `pnpm roadmap done <slug> --note`) where the shipped scope deviates; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change — N/A (no dependency changes)
- [x] Launch openspec-planning-reviewer was pass before apply (evidenced) — Verdict: pass (delta re-review after proposal/design/spec fixes)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive — Verdict: PASS (delta re-review)
- [x] Manual check (after implementation review pass, before archive): drive `pnpm dev` in the browser through the roadmap item's Browser check from `pnpm roadmap show <slug>` (or the spec scenarios for [prep]); record numbered steps and observed results under `## Manual test scenarios` at the end of this file (N/A for non-UI); a bug found → Playwright test + fix + re-run implementation review on the delta
- [x] Security Review: Cursor Security Review subagent before archive when the item is tagged (Security Review: …) or the change touches the security surface — N/A (not security-tagged; no security surface)

## Manual test scenarios

1. Fresh session editor → choose 4-grid → Add spread → new slot has 4 placeholders, radiogroup stays on 4-grid, new slot is active; document fits viewport (Playwright `add spread keeps the active spread template` + local preview evaluate).
2. Scroll pasteboard to top → first spread active, still 4-grid on radio and 4 placeholders.
3. Repeat path with default One per page Add spread → containment/reveal e2e still green (`add spread keeps the new spread inside the pasteboard`).
4. empty: normal visit — 3 spreads, radiogroup labeled "Template for this spread", no page scroll.
5. Assumptions: frame-budget LoAF flakes under parallel local load deferred to CI burn-in (same class as prior M2.1 flakes); not treated as product regressions from this change.
