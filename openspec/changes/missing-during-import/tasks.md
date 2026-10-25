## Implementation

- [x] 1. Add `manageImportRunning` to `importPhotoFiles` / `runChromeImport` (default true).
- [x] 2. Hold `importRunning` for the full `importScannedEntriesInBatches` loop; pass `manageImportRunning: false` per wave.
- [x] 3. Unit tests: flag stays true across batch boundaries; detect/autoDetect still suppress mid-import and surface real missing when idle (`folderImportBatches`, `importPhotos.identity`).
- [x] 4. Spec delta: editor-shell — no Missing/Rescan during active folder import.

## Manual test scenarios

1. New book → Choose photo folder (~many images): import bar shows progress; Missing dialog and “photos missing” pill must not appear mid-import.
2. After import completes with all Files present: no Missing UI.
3. Reload book without photo-folder permission (or delete files on disk): Missing/Rescan still opens when import is idle.
