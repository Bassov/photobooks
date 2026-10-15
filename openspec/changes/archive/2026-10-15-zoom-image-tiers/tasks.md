# Tasks

## 1. Tier choice and session files

- [x] 1.1 Add `selectImageTier` in `src/photo/imageTiers.ts` and verify unit plus fast-check tests: smallest covering step among 320, 640, 1280, 2560, else 2560
- [x] 1.2 Add `assetSources` retain/get and call it from import plus `loadPainterFixture` (four PNG files). Verify a unit test that the serialized book has no file bytes, and that fixture ids resolve to a session file

## 2. Cache and worker priority

- [x] 2.1 Add `tierCache` (bounded `ObjectUrlLru`, one URL per frame, per-key subscribe, one job per asset and tier) and verify eviction revokes and a second request for the same key does not enqueue twice
- [x] 2.2 Add pool priority `zoom` below `visible` and above `prefetch`, with a tier abort controller separate from import. Verify an existing-style `assetPool` test for rank, and that cancelling a tier still lets `runImportBatch` finish

## 3. Spread wiring

- [x] 3.1 Wire `ConnectedSpreadView` to committed zoom and `tierCache`: keep the previous URL until `decode()` resolves; pass `tierFor` into `SpreadView` as `data-tier`. Verify `SpreadView` and `ConnectedSpreadView` tests (empty placeholder, no source swap before decode). Reuse `src/photo/photo.test-helpers.ts`

## 4. Scenario and mutation list

- [x] 4.1 Extend `e2e/spread-view.spec.ts`: empty fixture frame has no image; after zoom to at least 400% and settle, a filled frame's `data-tier` covers on-screen size and the image stays; call `assertDocumentFitsViewport` and `assertNamedScrollport` for `pasteboard-scroll`. The continuous-zoom scenario still asserts zero LoAF and wheel p95, and a tier change inside the window
- [x] 4.2 Add `imageTiers.ts`, `assetSources.ts`, and `tierCache.ts` to `scripts/stryker-diff.mjs` and `stryker.config.json` so `pnpm stryker:diff` mutates them

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

- Archive the change after implementation review and Security Review pass, syncing delta specs.
- Tick the `zoom-image-tiers` roadmap checkbox in the same branch, without waiting for merge.
