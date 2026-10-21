# failed-import-no-tile

Tag: feature
Milestone: M2.2
Title: a photo that fails to decode leaves no tile, is not counted and cannot be placed
Status: done

## Scope

- [x] Root cause, verified on main: `importPhotoFilesInner` enqueues every accepted file into the gallery before decode (`src/editor/importPhotos.ts:74-78,138`, placeholder meta aspect 1), and only `onResult` handles outcomes (`:163-177`). `runImportBatch`'s catch (`src/photo/assetPool.ts:478-484`) pushes `{ name, message }` with no asset id (`ImportFileError` `:39-42`), so nothing removes the tile. The count reads `book.gallery.length` (`src/editor/Filmstrip.tsx:169` `data-gallery-count`)
- [x] `ImportFileError` gets an optional `assetId`, set in the batch catch. `runImportBatch` gets an `onError(assetId, error)` callback next to `onResult`. Early rejects (`importPhotos.ts:59-63`) stay without an id
- [x] On decode failure, remove the asset everywhere in one step: a `bookStore` helper that drops a still-pending id from `pendingGalleryIds` / `pendingMeta` / `pendingAssetRecords` / `pendingAssetPatches` (`src/editor/bookStore.ts:99,348-384,256-268`), otherwise dispatches `removeFromGallery` (`src/core/ops/gallery.ts:27`, which already cascades placements, `ops.test.ts:40`), plus `sessionMeta`. Also drop the retained source (new `releaseAssetSource`, `src/photo/assetSources.ts:8-26`). In the library-backed path, a late hash `patchAssetRecord` for a removed id must not re-create a record (`bookStore.ts:256-268`); check this against `reimport-async` if it has merged
- [x] Placement guard stays the gallery check (`src/editor/galleryDrop.ts:116,346`). Selecting a removed id clears the selection, and the move source too if it points at it
- [x] Spec delta: `photo-card` "Accepted and rejected image types" (`openspec/specs/photo-card/spec.md:23-35`) gets a decode-failure scenario, and `editor-shell` "Filmstrip placeholders and thumbnails" (`openspec/specs/editor-shell/spec.md:42-44`) says a placeholder whose decode fails is removed. Early enqueue stays
- [x] Tests: unit (`importPhotos` + `assetPool.test.ts` + `bookStore` helper): a failing decode removes the pending and flushed ids, the count drops, a placement made before the failure is cleared. e2e (`e2e/filmstrip.spec.ts`): generated `corrupt_truncated.jpg` alone gives the error, `data-gallery-count=0` and no tile; one valid JPEG + the corrupt one gives count 1 and one tile
- **Done when:** (1) the e2e regression test above fails on main (count 1, blank tile) and passes on the branch; (2) the unit tests show the gallery, count and placements are clean after a decode failure for a pending id and for a flushed id; (3) the spec deltas are archived; (4) patch coverage ≥ 85%, Stryker diff ≥ 85 with zero NoCoverage, and no gate weakened or newly excluded
- **Perf:** removal is O(1) per failure, batched into the existing rAF gallery flush; the bulk-import frame-budget scenario (`e2e/filmstrip.spec.ts:402-428`) stays at zero LoAF.
- **Browser check:** on the preview URL, Add photos with a truncated JPEG plus one valid photo. One error is listed, the counter says 1 photo, and the filmstrip has a single real thumbnail with no grey tile to select or place.
- **UI kit:** `uikit/src/features/m25.tsx:115-128` (`editor-chrome-states` Import error scenario, `UI ref: uikit#/feature/editor-chrome-states` — toast for unread files), `uikit/src/features/m0m1.tsx:248-256` (`editor-shell-filmstrip`, `UI ref: uikit#/feature/editor-shell-filmstrip` — progressive placeholders + failed-read toast). partial: no scenario where a decode failure removes a blank filmstrip tile
- **Size:** ~250–400 changed lines (assetPool callback + bookStore removal + importPhotos wiring + spec deltas + tests)
- **Source:** #35
