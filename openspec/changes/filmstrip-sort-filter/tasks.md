## Implementation

- [x] 1. `galleryView.ts`: pure sort (added/name/captured) + unplaced filter, with unit + PBT tests (`galleryView.test.ts`)
- [x] 2. `runJpegHeadPass`: reuse `extractAssetMetadata` → `patchAssetRecord(capturedAt)`, also for assets lacking it (`jpegHeadPass.test.ts`)
- [x] 3. `bookStore`: cached placed-id set snapshot; `removeAssetFromGallery`; `galleryRemoveRequest` store (`bookStore.galleryView.test.ts`, `galleryRemoveRequest.test.ts`)
- [x] 4. Dock header: Sort menu + "Unplaced only" toggle (`startTransition`), count "N of M" (`FilmstripSortFilter.test.tsx`)
- [x] 5. `Filmstrip` renders view (ids/aspects/names/spacer), empty-filter state (`FilmstripSortFilter.test.tsx`)
- [x] 6. Remove: × on thumb + Delete in `installEditorKeys`; AlertDialog when placed; status message; clear selection (`FilmstripSortFilter.test.tsx`)
- [x] 7. e2e: 1000-photo scroll + filter toggle zero LoAF; unplaced shrinks after placing; empty-filter; placed removal (`e2e/filmstrip.spec.ts` › sort / filter / remove; not run locally — worktree has no uikit deps, CI runs it)

## Manual test scenarios

1. Import 1000+ photos; scroll, switch sort, toggle "Unplaced only" — no jank.
2. Place a photo; "Unplaced only" shrinks by one.
3. Remove an unplaced photo (immediate) and a placed one (dialog; frame empties).
