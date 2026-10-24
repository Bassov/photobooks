## Decisions

1. **Scroll stability without freezing gallery:** Keep paced `enqueueGalleryAssets` flushes. Once an id is flushed into `book.gallery`, it stays. Remount after virtualization/LRU eviction republishes from in-session thumb bytes (`lastThumb`) even when `contentHash` is still pending — do not rely on DerivedCache-only hydrate during active import.
2. **Progressive durability:** Gallery/asset flushes already dirty `projectSession`. During `importRunning`, autosave MUST persist the book snapshot without waiting for the entire pending-hash set (hashes/thumbs may catch up later). Keep `bindPhotoFolder({ persist: false })` for the first import paint window; call `persistBoundPhotoFolder` after the first yielded batch (not only after the full folder) so mid-import reload can recall the handle.
3. **Boot continue:** Restore hydrates saved gallery immediately; prioritize book-used verify/re-hash as today; then import scanned entries whose `relativePath` is not yet in the gallery (background batches + `yieldForPaint`). No parallel persistence stack.

## Touch-set & Test Plan

- Files: `thumbCache.ts`, `FilmstripItem.tsx` (if needed), `bookStore.ts` (only if gallery race), `projectSession`/`autosaveController`, `photoRootSession.ts`, `useChromeImport.tsx`; specs `filmstrip`, `asset-source`, `editor-shell`; unit + `e2e/filmstrip.spec.ts` / open-save.
- Reuse: `importScannedEntriesInBatches`, `yieldForPaint`, `planRescanPriority`, `rememberSourceRootHandle` / `persistBoundPhotoFolder`, existing autosave dirty path.
- Tests: unit — LRU remount republish without hash; save during import does not await unbounded hashes; restore continues missing scanned entries. e2e — scroll mid-import keeps earlier revealed `data-asset-id`s; reload mid-import restores non-zero gallery (book-used first) and import progress continues. Skill `ui-review` before push (existing filmstrip tokens; no new visual system). No gate relaxations.
