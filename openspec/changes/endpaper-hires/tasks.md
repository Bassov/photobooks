## Implementation

- [x] 1. `useTierPreviewUrl` returns `{ url, tier }`; `CoverCanvas` front sets `data-tier`. Evidence: `src/editor/CoverCanvas.test.tsx` (front `data-tier` 1280, row and empty front without it).
- [x] 2. `EndpaperCanvas` uses `useTierPreviewUrl` with `tierSlot`; `EndpaperOverlay` passes it; pages set `data-tier`. Evidence: `src/editor/EndpaperCanvas.test.tsx`.
- [x] 3. Rename `useCoverPhotoUrl` → `useThumbUrl` (inspector thumbnails only); `grep -E "useCoverPhotoUrl|useThumbUrl" src/editor/*Canvas.tsx` is empty; PR body lists every thumb-only caller (fixed / left out + reason). Evidence: grep 0 hits.
- [x] 4. Painter fixture gets a cover and endpaper photo. Evidence: `src/core/testing/painterFixture.test.ts`.
- [x] 5. `e2e/spread-view.spec.ts`: `readTiers` replaces `readFilledTier`; covering-tier test samples page frame, cover front, endpaper; revert check recorded in the PR body. Evidence: reverted → fails on endpaper (tier null, longEdge 344); fixed → 3/3 pass (tier 1280).

## Manual test scenarios

1. Painter fixture, select the front endpaper → both pages show the photo with `data-tier="1280"`.
2. Book without an endpaper photo, select the endpaper → pattern, no `data-tier`.

manual-qa (2026-11-02): `pnpm agent manual-qa --change endpaper-hires` exits 1 at `start-session`, because the welcome `<header>` intercepts the click. The rig also never loads `?fixture=painter`. Both scenarios are therefore unverified by manual-qa (harness problem).

- Scenario 1: problem (harness). Covered by `e2e/spread-view.spec.ts` "zoomed fixture photos keep a covering tier" (3/3). The logged samples showed both endpaper pages at `data-tier` 1280, longEdge 344, `url("blob:…")`.
- Scenario 2: problem (harness). Covered by the unit test `src/editor/EndpaperCanvas.test.tsx` (no photo → empty inline background, no `data-tier`, no tier request) and by `e2e/design-r2-cover-book.spec.ts` M13 (Pattern pill).

ui-review: no chrome, token or control change. The e2e covers the happy and interact paths and the `assertDocumentFitsViewport` / `assertNamedScrollport` invariants; the unit test covers the empty path. No findings.
