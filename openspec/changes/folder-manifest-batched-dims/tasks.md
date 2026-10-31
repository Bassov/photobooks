## Implementation

- [x] 1. Failing unit test first: 200 concurrent `patchManifestDimensions` for one root keep all 200 dims in ≤ ceil(n/64)+2 writes (`src/project/session/sourceRootEntryIndex.batch.test.ts`; on origin/main code: 1/200 dims kept, 200 writes).
- [x] 2. Per-root coalescing queue in `src/project/session/sourceRootEntryIndex.ts`: pending Map, one serialized read-merge-write per root (idle with 500 ms timeout, or 64 pending); `persistScannedEntryIndex` runs on the same queue and merges pending patches.
- [x] 3. PBT: random interleavings of patch / persist keep every latest matching patch; stale size/mtime patches never land (same test file).

## Manual test scenarios

N/A — no UI change; covered by unit + PBT and the large-folder harness (`src/editor/folderImportPerf.test.ts`).
