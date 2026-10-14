# Design

## Context

See proposal.md. `importPhotoFiles` already enqueues all placeholder ids at batch start and flushes gallery via rAF (`GALLERY_FLUSH_CHUNK = 8`). `Filmstrip` reveals ids at `REVEAL_PER_FRAME = 2` and thumbs flush at 2/frame. The only blocker for mid-import visibility is `gallerySnapshotDuringImport` in `bookStore.getGalleryIdsSnapshot`. Decode remains in workers (`assetPool` / `processPhoto`).

## Goals / Non-Goals

**Goals:** remove the import-time gallery id freeze; keep placeholder-first enqueue + existing pacing; prove mid-import growth in unit/e2e; keep LoAF + page-fit gates.

**Non-Goals:** enqueue-on-result; picker/worker protocol changes; Virtualizer redesign; new modules.

## Touch-set

- `src/editor/bookStore.ts` — delete `gallerySnapshotDuringImport`; `getGalleryIdsSnapshot` always returns `state.book.gallery`; keep `importRunning` / `importExpectedCount` for spacer; lower `GALLERY_FLUSH_CHUNK` (8→4) for mid-import LoAF
- `src/editor/Filmstrip.tsx` — `REVEAL_PER_FRAME` 2→1
- `src/editor/thumbCache.ts` — thumb `FLUSH_PER_FRAME` 2→1
- `src/editor/bookStore.test.ts` — assert snapshot reflects flushed ids while import is running; chunk size expectations
- `e2e/filmstrip.spec.ts` — during bulk import, assert `data-gallery-count` grows before progress completes; keep scroll + LoAF + `assertDocumentFitsViewport` / `assertNamedScrollport` where already used
- `openspec/specs/editor-shell/spec.md` — via delta sync on archive

No changes expected to `importPhotos.ts`.

## Decisions

1. **Unfreeze, keep enqueue-at-start** — Placeholders appear as flush commits (not only after decode). Alternative (enqueue on `onResult`) rejected: worse “placeholders first” and slower first paint in the strip.
2. **Tighter rAF pacing under progressive mounts** — after unfreeze, bulk scroll LoAF failed at flush 8 / reveal 2 / thumb 2; applied flush 4 / reveal 1 / thumb 1. If e2e LoAF fails again, tune further before restoring freeze.
3. **Spacer unchanged** — `getSpacerCountSnapshot = max(gallery.length, importExpectedCount)` still reserves scroll extent for the full batch.
4. **Composition** — Store remains the single source for gallery ids; Filmstrip stays a thin `useSyncExternalStore` consumer; import orchestration stays in `importPhotos`.

## Tests

| Surface  | Public API                                                            | Assert                                                               |
| -------- | --------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Unit     | `getGalleryIdsSnapshot` / `setImportRunning` / `enqueueGalleryAssets` | Mid-import snapshot includes flushed ids; spacer uses expected count |
| E2E bulk | `data-gallery-count`, `import-progress`                               | Count increases while Importing is still visible                     |
| E2E perf | existing bulk scroll scenario                                         | zero LoAF; page-fit after load                                       |

Reuse `writeBulkImportFixtures`, `assertDocumentFitsViewport`, `assertNamedScrollport`, perf helpers in `e2e/`.

## Security

Blob/object URL thumb cache and worker `postMessage` paths are unchanged; no new File System Access surface.

## Risks / Trade-offs

- [GridList remount under throttle → LoAF] → keep rAF pacing; tune chunk/reveal; do not reintroduce freeze without a new OpenSpec change
- [Wide spacer during progressive growth] → viewport containment already shipped; keep page-fit asserts
