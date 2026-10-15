# Tasks

## 1. Status sentence

- [x] 1.1 Add `unplacedFromSpreadStatus` in `src/editor/editorStatus.ts`: `1 photo was unplaced from the spread` for one, and `N photos were unplaced from the spread` otherwise. Cover both sentences in `editorStatus.test.ts`

## 2. Template dispatch

- [x] 2.1 In `dispatchBookOp`, when an `applyTemplate` op changes the book, count prior frames at index `>=` the new frame length that have an `assetId`. If that count is at least one, set the polite status to `unplacedFromSpreadStatus`. If it is zero, or the book is unchanged, leave the status as it was. Do not announce `addSpread` reapply. Do not change `applyTemplate` rebind

## 3. Tests

- [x] 3.1 Add `makePlacedTemplateBook` in `src/core/testing/fixtures.ts`. `applyTemplate` from `4-grid` to `one-per-page` keeps the asset ids that still have slots, drops the rest, and leaves those ids in the gallery
- [x] 3.2 Through `dispatchBookOp`, assert the singular and plural status sentences, and that a template change which drops nothing leaves a prior status unchanged
- [x] 3.3 Add `e2e/template-unplace.spec.ts`: empty gallery chooses `4-grid` with no Placed badge and an empty status; two placed photos shrink to `one-per-page`, the badge count updates, both stay in the filmstrip, and the status is `1 photo was unplaced from the spread`; after unplace, switching `full-bleed` leaves `Photo unplaced`. Each case calls `assertDocumentFitsViewport`

## 4. Roadmap

- [x] 4.1 After the `drag-swap-unplace` checkbox in `docs/roadmap.md`, add only `- [ ] [feature] template-unplace-notice — a smaller template still drops overflow placements, photos stay in the gallery, and a polite status says how many were unplaced`. Tick it at archive

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
