# Tasks

## 1. Painter

- [x] 1.1 Add pure `frameBox` (mm rect and page-cut line to px at `SPREAD_PX_PER_MM`, image box from `sourceCropRect` `{x,y,width,height}`) and verify unit tests for scale, vertical vs horizontal cuts, and crop percentages
- [x] 1.2 Add presentational `SpreadView` (frames, empty placeholder, async image, `aria-hidden` cut) and verify component tests for empty vs filled, missing URL, crop box, and page cut

## 2. Subscription

- [x] 2.1 Add `subscribeSpread` and cached `getSpreadPaintSnapshot` (resolve only inside the cache) and verify a store test: one spread edit notifies only that spread, and an unchanged snapshot keeps its reference
- [x] 2.2 Add `ConnectedSpreadView` and verify a component test that editing one spread does not update the sibling's painted output

## 3. Fixture

- [x] 3.1 Add `makePainterFixture` (40 spreads, 4-grid, four shared assets, first frame of spread 0 empty, data-URL previews) and verify a unit test of those counts
- [x] 3.2 Load the fixture from `?fixture=painter` into a workspace vertical scrollport; without the query keep the placeholder. Verify component coverage of both modes
- [x] 3.3 Extend `assertNamedScrollport` with `axis: 'vertical'` (default horizontal) and add `e2e/spread-view.spec.ts`: 40 spreads, empty first frame, vertical scrollport, `assertDocumentFitsViewport`, and a normal visit still shows the placeholder

## 4. Boundaries

- [x] 4.1 Forbid `src/render` from importing editor/photo/platform and `src/core` from importing `render`; mutate `src/render/frameBox.ts` in `scripts/stryker-diff.mjs` and `stryker.config.json`; add the `src/render/` row to `AGENTS.md`. Verify `pnpm deps` and that `AGENTS.md` stays ≤150 lines

## 5. Verification checklist

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass
- [x] Agent docs: if module map / commands / security surface / durable conventions changed → update AGENTS.md (≤150 lines); update .cursor/rules or skills only when a lasting convention changed; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change (not applicable: no dependency or security-surface change)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced: pass, agent 7638bebf)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive (pass, agent 0f2486b9; medium cache-key and crop assertions fixed after)
- [x] High-risk security surface: Cursor Security Review subagent before archive (not applicable: painter uses static data URLs only)

## Workflow follow-up

- Archive after implementation review passes; sync delta specs into `openspec/specs/`.
- Tick `spread-view-painter` and its nested boxes in `docs/roadmap.md` in this PR, without waiting for merge.
