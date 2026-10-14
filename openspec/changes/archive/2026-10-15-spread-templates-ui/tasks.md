# Tasks

## 1. Page-role re-apply

- [x] 1.1 When `addSpread` changes an existing spread's page count and that spread stores a catalog `templateId`, re-apply that template so frames match the new page count. Verify with a unit test: appending to a three-spread `one-per-page` book gives the former last spread two one-per-page frames and the new last spread one empty one-per-page frame; a spread whose page count does not change keeps object identity.

## 2. Session book

- [x] 2.1 Build the session book from an empty spread list with three `addSpread` calls (`spread-1` through `spread-3`). Verify the editor shell test: `data-spread-count` is `3`, the placeholder sentence is absent, and a zero-height viewport still mounts only a window.

## 3. Template bar

- [x] 3.1 Add `SpreadTemplateBar` as a sibling above the pasteboard scrollport. The Pasteboard root is a column filling the workspace; the scrollport uses `flex: 1; min-height: 0; overflow: auto`. The bar exposes radiogroup "Spread template" with labeled radios Full bleed, One per page, 2-up, and 4-grid, plus an "Add spread" button, each with a visible `:focus-visible` ring. Choosing a radio applies that catalog template to the marked spread. Add spread appends a spread and scrolls the port to the end. Verify with a component test that the controls render with those names and that choosing 4-grid changes only the marked spread's frame count.

## 4. Sibling paint

- [x] 4.1 A template switch updates only the affected spread's painted output. Verify with the public `ConnectedSpreadView` profiler test: applying a template to one spread does not increment the sibling's render count.

## 5. Browser lock-in

- [x] 5.1 Playwright: a normal visit shows three spreads (one, two, then one empty placeholders) and `assertDocumentFitsViewport`. Choosing 4-grid paints four placeholders on the active spread only. Add spread raises the count to four, the previous end spread shows two one-per-page placeholders at two-page width, the new spread is inside `pasteboard-scroll`, and both `assertDocumentFitsViewport` and `assertNamedScrollport(page, 'pasteboard-scroll', { axis: 'vertical', nudgeHorizontal: false })` pass. A `frame-budget` scenario that switches template and adds a spread records zero LoAF so `pnpm perf` runs it.

## Verification

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass
- [x] Agent docs: if module map / commands / security surface / durable conventions changed → update AGENTS.md (≤150 lines); update .cursor/rules or skills only when a lasting convention changed; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] High-risk security surface: Cursor Security Review subagent before archive

## Workflow follow-up

- Archive `spread-templates-ui` with delta specs synced into `openspec/specs/`
- Tick `spread-templates-ui` in `docs/roadmap.md` in the same PR, without waiting for merge
