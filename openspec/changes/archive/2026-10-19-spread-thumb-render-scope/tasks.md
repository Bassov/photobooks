# Tasks

## 1. Roadmap item lines

- [x] 1.1 Add **Browser check:** and **Perf:** to `docs/roadmap/M2.2/spread-thumb-render-scope.md` (item lacked them; proposal assumption)

## 2. Confirm snapshot path (no thumbCache delete)

- [x] 2.1 Confirm `ConnectedSpreadView` uses per-spread `thumbSnapshotFor` + `subscribeAssetIds`/`subscribeThumb` (no `subscribeThumbPublishes` / no PR #89 ternary)
- [x] 2.2 Leave unused `thumbCache` global publish exports untouched (design: deleting them fails stryker:diff 85% / 0 NoCoverage on ensureThumb)

## 3. Done-when proof

- [x] 3.1 Add render-count test: distinct photos on s0/s1, no covering preview/tier; `setThumbUrl` for s0’s photo does not increase s1’s Profiler count; s0 shows the new thumb (query scoped to s0)

## 4. Verification gates

- [x] 4.1 `pnpm check` (OK lines only); targeted unit tests green
- [x] 4.2 Continuous-zoom frame-budget e2e green (`pnpm test:e2e:changed:quiet` / targeted spread-view case)
- [x] 4.3 `pnpm stryker:diff` on changed production code (≥85%, 0 NoCoverage)

## Verification checklist

- [x] pnpm check (only OK lines; then e2e/stryker/lhci/reviewer/manual items that still apply below)
- [x] pnpm test:e2e (or pnpm verify) when UI/browser scope requires it
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass
- [x] Docs/rules sync: if behavior, commands, CI output, module map or the roadmap item changed → update README.md, AGENTS.md (≤150 lines), affected .cursor/rules/*.mdc and skills, docs/future-architecture.md notes, and annotate the roadmap item file (or `pnpm roadmap done <slug> --note`) where the shipped scope deviates; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change
- [x] Launch openspec-planning-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] Manual check (after implementation review pass, before archive): drive `pnpm dev` in the browser through the roadmap item's Browser check from `pnpm roadmap show <slug>` (or the spec scenarios for [prep]); record numbered steps and observed results under `## Manual test scenarios` at the end of this file (N/A for non-UI); a bug found → Playwright test + fix + re-run implementation review on the delta
- [x] Security Review: Cursor Security Review subagent before archive when the item is tagged (Security Review: …) or the change touches the security surface

## Manual test scenarios

1. `pnpm check` → only OK lines (after merge of `origin/main` / #116). `pnpm stryker:diff` → skip (no mutable `src/` vs base).
2. **Browser check (RTL = production path):** mount two spreads with distinct placed photos `a`/`b`, empty previewUrls; publish thumb for `a` → s0 image `src` updates, s1 stays placeholder and Profiler count unchanged (`ConnectedSpreadView.test.tsx`).
3. Continuous zoom: `e2e/spread-view.spec.ts` “continuous zoom stays within frame-budget gates” → 1 passed (pasteboard still paints under zoom).
4. Live `pnpm exec vite` + Playwright: `/` → 0 spreads (empty home); `/?fixture=painter` → 4 spreads, 15 images + 1 placeholder (happy paint).
5. ui-review: no new chrome/controls; thumb fallback visually unchanged — pass.
6. lhci / audit:ci: N/A (no UI chrome or package.json/lockfile change).
