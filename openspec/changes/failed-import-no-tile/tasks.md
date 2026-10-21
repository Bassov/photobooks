## Implementation

- [x] 1. Add `onError` to `runImportBatch`; ensure batch catch sets `assetId` on `ImportFileError` — `src/photo/assetPool.ts` + `assetPool.test.ts`
- [x] 2. Add `releaseAssetSource` in `assetSources` (+ unit) — `src/photo/assetSources.ts`
- [x] 3. Add `removeFailedImportAsset` in `bookStore` (pending drop / `removeFromGallery` + sessionMeta + dropped-id guard for `patchAssetRecord`); clear matching gallery selection; move-source via frameSelection subscription — `src/editor/bookStore.ts`
- [x] 4. Wire `importPhotos` `onError` → remove + release; unit coverage for pending and flushed failure — `src/editor/importPhotos.ts` + tests
- [x] 5. Spec deltas: `photo-card` decode-failure scenario; `editor-shell` failed-decode tile removal — `openspec/changes/failed-import-no-tile/specs/`
- [x] 6. e2e `filmstrip.spec.ts`: corrupt JPEG alone and valid+corrupt count/tile assertions; import-errors-panel expects Not imported for decode failure

## Manual test scenarios

1. Session editor: Add photos with one truncated JPEG alone → import error listed, `data-gallery-count` 0, no filmstrip tile.
2. Same: one valid JPEG + truncated JPEG → one error, count 1, single real thumbnail (no grey tile to select/place).
3. Filmstrip scrollport only (no page-level H/V scroll) after the mixed import.
