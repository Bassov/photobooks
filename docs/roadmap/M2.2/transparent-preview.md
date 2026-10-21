# transparent-preview

Tag: feature
Milestone: M2.2
Title: transparent PNG / WebP areas stay transparent in thumbnails and frames
Status: done

## Scope

- [x] Root cause, verified on main: `buildPreview` (`src/photo/processPhoto.ts:87-118`) always encodes with `canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 })` and returns `mimeType: 'image/jpeg'` (`:116-117`), so alpha becomes black. The same function makes thumbnails (`THUMB_MAX_EDGE`, `src/photo/assetPool.ts`) and zoom tiers (`src/photo/tierCache.ts:130-145`)
- [x] Encode by source type: JPEG sources stay JPEG 0.85 (bytes unchanged for the common case). PNG and WebP sources encode as `image/webp` 0.85, which keeps alpha. Return `blob.type` as `previewMimeType` (not a hard-coded string), so a browser that falls back to PNG is still labeled correctly. Pass the source `mimeType` into `buildPreview` (`:169-174`)
- [x] Check the consumers that take the preview mime: `setThumbUrl` (`src/editor/importPhotos.ts:171-176`, `src/editor/thumbCache.ts:33-37,77-93`), DerivedCache thumb/tier entries (`thumbCache.ts:140-147`, `tierCache.ts:81-108`), `restoreAspectFromPreview` (`src/editor/previewAspect.ts:32-70`; the non-JPEG path uses the worker, so check there is no regression for cached WebP previews), and `src/photo/loadPhoto.ts:38`. Change nothing if they already pass the mime through
- [x] RGBA fixture: `transparent_corners.png` (opaque center, alpha=0 corners; colorType 6) from `e2e/fixtures/write-sample-png.mjs` (today it writes RGB, `IHDR` at `:54`), plus an RGBA WebP if `webp-import` has landed its writer
- [x] Unit test (`src/photo/processPhoto.test.ts`): a PNG request asks `convertToBlob` for `image/webp` and reports the blob's type; a JPEG request still asks for `image/jpeg`
- [x] e2e: import `transparent_corners.png` and place it in a frame. Sample a corner pixel of the filmstrip thumbnail and of the frame image (canvas `drawImage` + `getImageData` in the page, or `toHaveScreenshot` clip once `docs/backlog/visual-regression-e2e.md` returns to the roadmap): alpha is 0 in the preview / the frame shows the page background, not `rgb(0,0,0)`
- Out of scope: PDF/print compositing (M6); checkerboard styling for filmstrip tiles (the filmstrip background showing through is enough)
- **Done when:** (1) the e2e regression test above fails on main (black corner) and passes on the branch; (2) JPEG previews are byte-identical in format (`image/jpeg`) to main; (3) the unit tests above pass; (4) patch coverage ≥ 85%, Stryker diff ≥ 85 with zero NoCoverage, and no gate weakened or newly excluded
- **Perf:** encoding stays in the photo worker; WebP encode only for PNG/WebP sources. The bulk-import frame-budget scenario (JPEG fixtures) and `pnpm bench` photo cases stay within budget.
- **Browser check:** on the preview URL, Add photos with a PNG that has transparent corners. The filmstrip thumbnail shows the filmstrip background in the corners, and placed in a frame the corners show the page color, not black. Zoom in so a sharper tier loads, and the corners stay transparent.
- **UI kit:** none (no matching component)
- **Size:** ~150–250 changed lines (buildPreview + RGBA fixture + unit + e2e)
- **Source:** #36
