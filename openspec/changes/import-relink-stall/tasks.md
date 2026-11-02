## Implementation

- [x] 1. Regression e2e `e2e/import-relink-stall.spec.ts` (fails on `origin/main` at "Importing 16 / 21…"); spec deltas
- [x] 2. Unit test, then `persistBoundPhotoFolder` returns remembered and keeps the in-memory binding on failure (`photoRootSession.test.ts`)
- [x] 3. Unit test, then `importScannedEntriesInBatches` finishes every batch when the first-batch hook fails, then rethrows (`folderImportBatches.test.ts`)
- [x] 4. Unit test, then `importPickedFolder`: persist once, status on failure, catch always clears progress + importRunning (`useChromeImport.persist.test.tsx`)

## Manual test scenarios

1. N/A: no new UI surface; the e2e covers the status line and the absent dialog.
