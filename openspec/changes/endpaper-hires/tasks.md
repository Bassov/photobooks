## Implementation

- [x] 1. `useTierPreviewUrl` returns `{ url, tier }`; `CoverCanvas` front sets `data-tier`. Evidence: `src/editor/CoverCanvas.test.tsx` (front `data-tier` 1280, row and empty front without it).
- [x] 2. `EndpaperCanvas` uses `useTierPreviewUrl` with `tierSlot`; `EndpaperOverlay` passes it; pages set `data-tier`. Evidence: `src/editor/EndpaperCanvas.test.tsx`.
- [x] 3. Rename `useCoverPhotoUrl` → `useThumbUrl` (inspector thumbnails only); `grep -E "useCoverPhotoUrl|useThumbUrl" src/editor/*Canvas.tsx` is empty; PR body lists every thumb-only caller (fixed / left out + reason). Evidence: grep 0 hits.
- [x] 4. Painter fixture gets a cover and endpaper photo. Evidence: `src/core/testing/painterFixture.test.ts`.
- [x] 5. `e2e/spread-view.spec.ts`: `readTiers` replaces `readFilledTier`; covering-tier test samples page frame, cover front, endpaper; revert check recorded in the PR body. Evidence: reverted → fails on endpaper (tier null, longEdge 344); fixed → 3/3 pass (tier 1280).

## Manual test scenarios

1. Painter fixture, select the front endpaper → both pages show the photo with `data-tier="1280"`.
2. Book without an endpaper photo, select the endpaper → pattern, no `data-tier`.
