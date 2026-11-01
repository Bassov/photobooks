## Implementation

- [x] 1. Failing e2e: cover vs page frame natural width; library tile (`e2e/cover-hires.spec.ts`; fails on `origin/main` with 320 vs 1280)
- [x] 2. Extract `holdDisplayTiers` from `ConnectedSpreadView` (`src/editor/holdDisplayTiers.ts`; `ConnectedSpreadView.test.tsx` unchanged and green)
- [x] 3. `useTierPreviewUrl` + cover canvas / Preview wiring (`CoverCanvas.test.tsx`: canvas swaps to 1280, list row stays thumb, empty front plain)
- [x] 4. Library tile reads `tier-1280` then `thumb` (`useCachedCoverUrl.test.tsx`)

## Manual test scenarios

1. Drop a large photo on the cover: it sharpens like a page frame with the same photo.
2. Back to the library: the book tile cover is sharp (not the thumb).

manual-qa (`pnpm agent manual-qa --change cover-hires`): harness problem for both scenarios: `start-session` click intercepted by the welcome header (`locator.click: Timeout 30000ms exceeded`). Product behavior is locked by `e2e/cover-hires.spec.ts` (cover 1280 = page frame 1280; library tile 1280), green on this branch.

ui-review: no findings (image source only; no tokens, controls, states or scrollports changed; empty front plain in `CoverCanvas.test.tsx`).
