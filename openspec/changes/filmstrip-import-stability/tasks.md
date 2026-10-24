## Implementation

- [x] 1. Spec deltas: filmstrip / asset-source / editor-shell under `openspec/changes/filmstrip-import-stability/specs/`
- [x] 2. Thumb remount: `ensureThumb` republishes `lastThumb` on LRU miss (`thumbCache.ts`); FilmstripItem always calls ensureThumb
- [x] 3. Progressive save: skip full hash wait while `importRunning` (`projectSession.ts`); `onFirstBatchYielded` → `persistBoundPhotoFolder` (`useChromeImport.tsx`)
- [x] 4. Boot continue: `startFolderRescan` imports missing scanned entries when directory present (`photoRootSession.ts`)
- [x] 5. Unit: thumbCache remount, projectSession import-time save, folderImportBatches first-yield, folderRescan continue-import
- [x] 6. e2e: `scroll mid-import keeps earlier revealed tile ids`; `reload mid-import restores partial gallery and continues import`

## Manual test scenarios

1. Large folder (~hundreds+): start import, scroll filmstrip mid-import — earlier revealed thumbs stay or return when scrolled back; gallery count does not lose flushed ids.
2. Mid-import: place one photo, reload — filmstrip shows restored tiles (at least placed), import/rescan progress continues for remainder.
3. N/A for unsupported-browser / multi-folder (out of scope).
