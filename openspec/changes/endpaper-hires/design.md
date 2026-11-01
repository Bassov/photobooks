## Decisions

1. Reuse `useTierPreviewUrl` (cover-hires). It returns `{ url, tier }` instead of a bare URL: `tier` is the shown tier from `getTierDisplaySnapshot()` and is `undefined` while the thumb shows. No second tier hook.
2. `EndpaperCanvas` takes `tierSlot?: string` like `CoverCanvas`; `EndpaperOverlay` passes `endpaper:canvas`, the mini row passes none (thumb, no tier request).
3. Cover front and endpaper pages keep `background-image` (cover-hires e2e and kit look read it); the photo element carries `data-tier` when a tier shows. `readTiers(page, selector)` samples any element: `src` for `<img>`, else the inline background.
4. `useCoverPhotoUrl` → `useThumbUrl` (file rename); callers: `useTierPreviewUrl`, PhotoSection, CoverSection, EndpaperSection.
5. Painter fixture: cover photo `painter-a`, endpaper photo `painter-b` (endpapers same → both sides).
6. Design tokens: N/A, no visual change (URL swap + `data-tier`).

## Touch-set & Test Plan

- Files: `src/editor/{useTierPreviewUrl,useThumbUrl,EndpaperCanvas,EndpaperOverlay,CoverCanvas,PhotoSection,CoverSection,EndpaperSection}.tsx?`, `src/core/testing/painterFixture.ts`, `e2e/spread-view.spec.ts`, unit tests next to them, `openspec/specs/image-tiers/spec.md`.
- Reuse: `holdDisplayTiers`, `tierDisplay`, `CoverCanvas.test` tier stubs.
- Tests: unit — endpaper canvas swaps to the 1280 URL with `data-tier`, mini row stays on the thumb without a tier request; cover front gets `data-tier`; fixture test pins cover/endpaper photos. e2e — covering-tier test asserts page frame, cover front and both endpaper pages; fails on the endpaper sample with the EndpaperCanvas change reverted.
