## Implementation

- [x] 1. `scanWalk`: per-directory `getFile()` with bounded parallelism (16); entries carry the live `File` (unit: peak in-flight 2–16). Evidence: `src/assets/scanWalk.test.ts` (memory + browser handle walks reach peak 16).
- [x] 2. FSA `scanRoot`: tag walk Files with their relative path; manifest stays metadata only. Evidence: `src/assets/fsaAssetSource.test.ts` "scan entries carry the walk File…".
- [x] 3. `startFolderRescan` priority verify retains the scanned `File`; `resolveFile` only when the scan has none (harness: 0 `resolveFile` calls, used-in-book first). Evidence: `src/editor/folderImportPerf.test.ts` "reopen re-scan…" (fails on origin/main with 3202 calls), `src/editor/folderRescan.test.ts` fallback concurrency test.
- [x] 4. `startFolderRescan`: Set / Map lookups for priority dedupe, new paths and changed-path gallery ids. Evidence: `src/editor/folderRescan.test.ts` "verifies each changed path once…".

## Manual test scenarios

N/A (no UI change; covered by `e2e/photo-folder-regrant.spec.ts` (2 passed locally) and the large-folder harness).
