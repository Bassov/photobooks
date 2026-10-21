## Decisions

1. Keep early enqueue; add `runImportBatch` `onError(assetId, error)` beside `onResult`. `ImportFileError.assetId` already exists — set in batch catch (early rejects stay id-less).
2. `removeFailedImportAsset(assetId)`: drop still-pending id from pending queues/maps, else `dispatchBookOp({ type: 'removeFromGallery' })` (cascade placements). Drop sessionMeta; mark dropped so late `patchAssetRecord` cannot resurrect. Call `releaseAssetSource`. Clear gallery selection when it matches; frame move-source clears via existing `frameSelection` bookStore subscription when the sourced frame is emptied.
3. Placement guard stays `gallery.includes` in `galleryDrop`. No EditorShell / pickPhotos / processPhoto changes. Decode stays in the existing worker path.

## Touch-set & Test Plan

- Files: `assetPool.ts`, `assetSources.ts`, `importPhotos.ts`, `bookStore.ts`, `galleryDrop.ts` (selection/move-source clear), specs `photo-card` + `editor-shell`, `e2e/filmstrip.spec.ts`, matching unit tests. No gate-config edits.
- Reuse: `removeFromGallery`, `createImportFileError`, rAF flush, import-error Status/panel.
- Tests: unit — pending + flushed failure clears gallery/count/placements/source/selection/move-source; late patch no-op. e2e — corrupt JPEG alone → error, count 0, no tile; valid+corrupt → count 1, one tile. Skill `ui-review` before push. Tokens: existing import-error Status / filmstrip placeholders (`docs/design.md`).
