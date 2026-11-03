## Implementation

- [x] 1. Hidden-path rule in `src/photo/pickPhotos.ts` used by `isAcceptedPhotoPath`, `isImageLikePath`, `isClearFolderSkipPath`, `partitionImportFiles`; unit table from the brief (`src/photo/pickPhotos.test.ts` "hidden / OS metadata paths", "skips hidden files from any source")
- [x] 2. Folder manifest `decodeFailed` flag: parse, keep on unchanged walk, clear on size/mtime change, `patchManifestDecodeFailed`; unit tests (`src/project/session/sourceRootEntryIndex.test.ts` "remembers a decode failure only while size and mtime match")
- [x] 3. `discardFailedImport` patches the manifest via `tryMarkManifestDecodeFailed` (`src/editor/folderManifestWrite.ts`); failed entries are filtered before the manifest / walk enqueue in `startFolderRescan` instead of editing `enqueueScannedGalleryList.ts` (`src/editor/importPhotos.test.ts`, `src/editor/folderManifestWrite.test.ts`)
- [x] 4. `startFolderRescan`: drop hidden / failed unplaced gallery ids, keep failed paths out of lazy import, re-report them in Import errors (`src/editor/folderRescan.test.ts` "drops hidden and known decode-failed tiles and re-reports failures once")
- [x] 5. e2e `e2e/filmstrip-appledouble-skip.spec.ts`: metadata folder (reload ×2, re-add) and corrupt JPG (reload ×2)

## Manual test scenarios

1. Library book → Add folder with `._X.JPG`, `.DS_Store`, `.Trashes/x.jpg`, 3 real JPGs → 3 tiles, no Import errors; reload twice → 3 decoded tiles; Add folder again → no errors.
2. Folder with 2 JPGs + truncated `broken.jpg` → 2 tiles + "Couldn't decode (1)"; reload → still 2 tiles and `broken.jpg` under Couldn't decode.

No UI code changed, so `pnpm agent manual-qa` was not run; both scenarios are automated in `e2e/filmstrip-appledouble-skip.spec.ts`:

- OK scenario 1: 3 tiles / 0 gray / 0 errors after import, after reload ×2, after re-add (e2e pass)
- OK scenario 2: 2 tiles / 0 gray / `broken.jpg` listed after import and after reload ×2 (e2e pass)
