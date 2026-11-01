## Implementation

- [x] 1. Failing e2e: cover vs page frame natural width; library tile (`e2e/cover-hires.spec.ts`; fails on `origin/main` with 320 vs 1280)
- [x] 2. Extract `holdDisplayTiers` from `ConnectedSpreadView` (`src/editor/holdDisplayTiers.ts`; `ConnectedSpreadView.test.tsx` unchanged and green)
- [x] 3. `useTierPreviewUrl` + cover canvas / Preview wiring (`CoverCanvas.test.tsx`: canvas swaps to 1280, list row stays thumb, empty front plain)
- [x] 4. Library tile reads `tier-1280` then `thumb` (`useCachedCoverUrl.test.tsx`)

## Manual test scenarios

1. Drop a large photo on the cover: it sharpens like a page frame with the same photo.
2. Back to the library: the book tile cover is sharp (not the thumb).
