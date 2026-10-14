# Tasks

## 1. Unfreeze gallery snapshot

- [x] 1.1 Remove `gallerySnapshotDuringImport` from `src/editor/bookStore.ts`; `getGalleryIdsSnapshot` always returns `state.book.gallery`; clear freeze branches in `setImportRunning` / `resetBookStore`
- [x] 1.2 Update `src/editor/bookStore.test.ts`: while import is running, flushed ids appear in `getGalleryIdsSnapshot`; keep spacer / redundant `setImportRunning` coverage

## 2. E2E progressive visibility

- [x] 2.1 In `e2e/filmstrip.spec.ts`, during bulk import assert `data-gallery-count` increases while `import-progress` is still visible; keep scroll-during-import LoAF gates and page-fit helpers (`assertDocumentFitsViewport` / existing named scrollport usage)

## 3. Finish

- [x] 3.1 Sync delta `editor-shell` into main specs on archive
- [x] 3.2 Append `docs/lessons.md` pacing lesson (progressive mounts vs freeze)

## Verification

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected (N/A — pacing constants only)
- [x] Agent docs: if module map / commands / security surface / durable conventions changed → update AGENTS.md (≤150 lines); update .cursor/rules or skills only when a lasting convention changed; do not add alwaysApply rules without merging/removing another (N/A)
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change (N/A)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced) — pass, agent 6a4e8e0a-4697-4363-a8ee-dea732e3ca77
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] High-risk security surface: Cursor Security Review subagent before archive (N/A — blob/worker surface unchanged)
