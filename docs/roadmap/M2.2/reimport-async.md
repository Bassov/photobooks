# reimport-async

Tag: feature
Milestone: M2.2
Title: re-import into an existing project starts as fast as a fresh import
Status: done

<!-- Requested tag was `fix`; `scripts/roadmap.mjs:12` only accepts prep|feature|contingency, so this uses `feature` (visible on the preview URL). -->

## Scope

- [x] `importPhotoFilesInner` in a library-backed book no longer waits for every file before showing anything: today `src/editor/importPhotos.ts:83-126` runs `await Promise.all(prepared.map(… await entry.file.arrayBuffer() … bytes.slice(0) …))` over the whole selection, and only then calls `enqueueGalleryAssets` (`:138`) and `runImportBatch` (`:160`). Gallery placeholders and decode jobs go in immediately from the cheap identity fields (`relativePath`, `file.size`, `file.lastModified`), the same way the session path (`:127-136`) does
- [x] Reading bytes for `memorySource.seedFile` and the content hash happens per file, after (or alongside) that file's decode, with a cap on how many reads run at once (no more than `runImportBatch`'s `START_CHUNK` = 16, `src/photo/assetPool.ts:454`). No `Promise.all` over the whole set; the main-thread `bytes.slice(0)` copy (`importPhotos.ts:96`) goes away or is limited to one in-flight window
- [x] Hash jobs stay at `hash` priority behind decode (`assetPool.ts:156-170`); a late hash still reaches `patchAssetRecord` / `putCachedThumbForHash` / `putCachedTierForHash` and Save still waits for it through `awaitPendingHashes`
- [x] Same cap on reads in `upgradeSessionAssetsForLibrary` (`src/editor/upgradeSessionAssets.ts:53-88`, same whole-set `Promise.all` + `arrayBuffer`), so adopting a session book into a library doesn't stall either
- [x] Unit test (`importPhotos.identity.test.ts`, `libraryBacked: true`): with N files whose `arrayBuffer()` never resolves, `enqueueGalleryAssets` and the first `processAsset` still run, and at most 16 `arrayBuffer()` calls are pending at any moment
- [x] e2e (library-backed, `attachMemoryLibraryForTests` or open a library book): open a project with an empty DerivedCache, re-import the 200-file bulk fixture (`e2e/filmstrip.spec.ts` `writeBulkImportFixtures`), and assert the first-card / progress timing below
- [x] Re-importing photos that are already in the project creates NO duplicate gallery entries and restores their thumbnails (owner decision 2026-10-19). Code reading suggests every import mints new ids (`mintAssetId`, new `root-<uuid>`, `importPhotos.ts:66-68,75`), but the owner saw no visible duplicates: FIRST write a failing-or-passing test (unit + library-backed e2e: import N photos, clear thumbnail cache, re-import the same files -> gallery count stays N, same asset ids, thumbnails back). If it already passes, keep the test and change nothing; if it fails, match re-imported files to existing assets (relative path + size + mtime, then content hash) and reuse them.
- Out of scope: moved-folder relink (`missing-assets-relink`, M2.5)
- **Done when:** (1) on re-import of 200 already-imported photos into a library-backed project with an empty thumbnail cache, `import-progress` shows "Importing" and `data-gallery-count > 0` while the import runs, within the same 30 s / 60 s deadlines as the fresh-import frame-budget scenario (`e2e/filmstrip.spec.ts:402-428`), and the time from `setFiles` to the first gallery card is no more than 1.5× the session-path time measured in the same run (record both numbers in the PR); (2) the unit test above shows the first gallery enqueue and decode happen before any file body read finishes and that reads are capped at 16 in flight; (3) the scroll-during-import window records zero LoAF (`PERF_BUDGETS.loafEntriesMax = 0`), handler p95 stays ≤ `handlerP95Ms × cpuThrottleRate` (2 ms × 2), and INP stays ≤ 100 ms (`src/perf/budgets.ts`, `e2e/perf/budgets.ts`); (4) the no-duplicates test above passes (gallery count unchanged, asset ids reused, thumbnails restored); (5) patch coverage ≥ 85% (`codecov.yml` patch target), Stryker diff score ≥ 85 (`quality/gates.json` `diffThresholds.break`), no gate weakened or newly excluded
- **Perf:** stream identity first, read bytes on demand with a capped window, hash in the existing hash worker at lowest priority; no full-set pass on the main thread. Gate: a library-backed copy of the `frame-budget gates` bulk-import scenario (200 files, scroll while importing): zero LoAF, handler/INP within budget.
- **Browser check:** open an existing project from the library whose thumbnails are gone (clear site data for the DerivedCache / OPFS only), pick the original photos again. Placeholders and the progress bar appear immediately, the same as importing into a new session book, thumbnails fill in progressively, the filmstrip scrolls without stutter, and after reload the thumbnails come back from the cache.
- **Size:** ~300–450 changed lines (importPhotos + upgradeSessionAssets + unit tests + one e2e scenario)
- **Source:** #125

## Done note

Identity-first library re-import with ≤16 in-flight body reads; path+size+mtime reuse; contentHash reuse deferred.
