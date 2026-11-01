# thumb-reload-cache-miss

Tag: feature
Milestone: P1
Title: Bug: gallery photos without a cached thumb stay gray after reload
Status: done

## Scope

- [x] Repro as e2e first (must fail on main): library-backed book, photo folder of ≥ 60 small JPEGs (EXIF orientation 1 and 6), only the first filmstrip window is ever shown; save; reload; scroll to the tail; tail tiles must get thumbs. Why it fails today: after reload `ensureThumb` (`src/editor/thumbCache.ts`) only reads DerivedCache; the lazy-decode map in `src/photo/assetPool.ts` lives in memory; `startFolderRescan` (`src/editor/photoRootSession.ts`) puts every gallery asset on the verify list and never re-imports it; the JPEG head pass does not run on restore. `e2e/open-save.spec.ts` bulk reload uses PNG (eager decode), so it does not catch this.
- [x] Fix: on a DerivedCache miss for an asset in the now set (mounted filmstrip window, painted spread, book-used), queue thumb320 at now priority through the decode pool; resolve the `File` through the registered `AssetSource` when `retainAssetSource` has not run yet.
- [x] Tail tiles show an upright thumb after scrolling, with no other user action.
- **Done when:** the new e2e passes (and fails without the fix); `e2e/open-save.spec.ts` bulk reload green.
- **Browser check:** folder with 200+ JPEGs: look only at the first screen, save, reload, scroll to the end: every tile fills in, none stays gray.
- **Perf:** the `1000-photo gallery scroll, sort and filter toggle` `frame-budget gates` scenario stays at 0 LoAF.
- **UI kit:** `uikit#/feature/editor-shell-filmstrip` (`uikit/src/features/pages.tsx` page `editor-shell-filmstrip`); parts: `uikit/src/demo-parts/editor.tsx` (`PhotosDock, FilmstripPart`); no visual change
- **Test:** new e2e + unit for the cache-miss branch
- **Depends:** none
