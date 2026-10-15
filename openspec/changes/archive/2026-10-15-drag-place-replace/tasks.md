# Tasks

## 1. Hit-test

- [x] 1.1 Add `buildDropIndex` and `hitTestDrop` in `src/editor/dropTargets.ts` (index built for `dragstart`; world X includes slot centering; world Y uses stride plus `frameBox`; no allocation in `hitTestDrop`). Verify unit and fast-check tests: a point inside a rect hits that frame, a miss hits nothing, higher `z` wins. Add `dropTargets.ts` to `EDITOR_MUTATE` in `scripts/stryker-diff.mjs` and `stryker.config.json`

## 2. Gallery chrome

- [x] 2.1 Add `getPlacementCountSnapshot` on book identity and a Placed badge on `FilmstripItem` when the count is greater than zero. Verify a `Filmstrip` test: a placed asset shows the badge and stays in the gallery; an unplaced asset does not
- [x] 2.2 Add `gallerySelection` and native filmstrip drag (`application/x-photobooks-asset`, no `setDragImage`). Verify a `Filmstrip` test that dragstart sets that id and selection follows the grid

## 3. Drop and keyboard

- [x] 3.1 Add `dropHover` and pasteboard `dragover`/`drop`: cache origin, index, and frame elements at dragstart; `dragover` only scrolls plus `hitTestDrop` inside `measureHandlerSync('dragover')`; one `place` or `replace` op; ignore gesture and file drags. Verify a pasteboard test that a synthesized dragover sets `data-drop-hover` on one frame and a drop places or replaces
- [x] 3.2 Optional frame button on `SpreadView` (`Place photo` / `Replace photo`) wired from `ConnectedSpreadView`. `[data-drop-hover]` is an outline in `SpreadView.css`. Verify: no selection leaves the book unchanged; Enter places or replaces; without controls the frame stays a `div`

## 4. Browser scenarios

- [x] 4.1 Add `e2e/drag-place.spec.ts`: empty gallery has no badge and activation leaves placeholders; two imported photos, keyboard place then replace, badges follow, both stay in the filmstrip, `assertDocumentFitsViewport`; synthesized drag moves `data-drop-hover` to a second frame and a non-frame point clears it
- [x] 4.2 Add a `frame-budget` scenario in that file: `/?fixture=painter&perf=1`, zoom until every spread is mounted, dispatch `dragover` across the book, assert zero LoAF and `dragover` p95. Point `pnpm perf` at the file

## Verification

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass
- [x] Agent docs: if module map / commands / security surface / durable conventions changed → update AGENTS.md (≤150 lines); update .cursor/rules or skills only when a lasting convention changed; do not add alwaysApply rules without merging/removing another (N/A — no module-map or convention change)
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change (script-only `package.json` edit; no high production advisories)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] High-risk security surface: Cursor Security Review subagent before archive (N/A — drag payload is an asset id; no File System Access, worker, header, dependency, or export change)

## Workflow follow-up

- Archive after implementation review passes, syncing delta specs.
- Tick `drag-place-replace` and `far-zoom-lod` (not needed; gate passed in `camera-zoom-pan`) in `docs/roadmap.md` in the same branch, without waiting for merge.
- Open the PR with a Manual testing section, then wait for CI and add tests if coverage or mutants ask for them.
