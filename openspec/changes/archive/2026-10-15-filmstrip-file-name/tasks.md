# Tasks

## 1. Label source

- [x] 1.1 Add `getAssetDisplayName` and a referentially stable `getGalleryDisplayNamesSnapshot` in `src/editor/bookStore.ts`. A non-empty session file name wins; otherwise the asset id. Do not change `mintAssetId`. Verify `bookStore.test.ts`: the snapshot array is unchanged while session meta identity is unchanged, and a name update changes the label
- [x] 1.2 In `src/editor/Filmstrip.tsx`, set each window item `name` from that snapshot (fallback to the asset id). Keep item `id` and drag payload as the asset id. Verify the filmstrip re-renders the label after a session-meta update without changing gallery ids

## 2. Tests and roadmap

- [x] 2.1 Extend `seedGallery` in `src/editor/gallery.test-helpers.ts` with an optional display name so tests do not copy store setup. In `Filmstrip.test.tsx`, render public `Filmstrip`: session meta `фото отпуск 01.jpg` is the thumbnail accessible name; a missing name equals the asset id
- [x] 2.2 In `e2e/filmstrip.spec.ts`, import `photoFixturePaths.samplePng` bytes under a non-ASCII file name via `photo-file-input`. Assert that accessible name, that activating the thumbnail selects it, and `assertDocumentFitsViewport`. Keep the existing empty-gallery copy test
- [x] 2.3 Add an unchecked roadmap item after `drag-swap-unplace`: `[feature] filmstrip-file-name — filmstrip label uses the imported file name, not the sanitized asset id`. Verify it is the only new checkbox

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

- Archive after implementation review passes, syncing the `editor-shell` delta.
- Tick the `filmstrip-file-name` roadmap checkbox in the same change.
- Commit, push `feat/filmstrip-file-name`, and open the pull request.
