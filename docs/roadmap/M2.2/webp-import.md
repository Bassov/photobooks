# webp-import

Tag: feature
Milestone: M2.2
Title: WebP photos import instead of failing with "Unknown file format"
Status: done

## Scope

- [x] Root cause, verified on main: `processPhotoRequest` (`src/photo/processPhoto.ts:131-135`) calls `exifr.parse(buffer, { pick: [ImageWidth, …] })` with no guard of its own, so when exifr throws for WebP ("Unknown file format"), the outer catch (`:193-196`) fails the whole job before `createImageBitmap` (`:154`) runs. `readOrientation` (`:43-70`) already wraps exifr and falls back to orientation 1. Treat a size-parse failure the same way: catch it, use `{}`, and let width/height fall back to SOF and then `bitmap.width/height` (`:159-165`). Do not catch `createImageBitmap` errors, so a really corrupt file still fails
- [x] Generated WebP fixtures (lossy + lossless, landscape 3:2) next to `e2e/fixtures/write-sample-png.mjs` (for example `write-sample-webp.mjs`, wired through `e2e/fixtures/ensurePhotoFixtures.ts`), plus a truncated/corrupt WebP. Keep the bytes small and deterministic
- [x] Unit test (`src/photo/processPhoto.test.ts`): with exifr mocked to throw `Unknown file format` on the size parse, a WebP request returns `ok: true` with bitmap dimensions; with `createImageBitmap` rejecting, the job still returns `ok: false`
- [x] e2e (`e2e/filmstrip.spec.ts`, photo-file-input path): import the lossy and lossless WebP fixtures. Both get a thumbnail, `data-gallery-count` counts them, no `import-errors`, one is placed in a frame and its `spread-frame-image` renders (naturalWidth > 0)
- Out of scope: WebP transparency (`transparent-preview` owns it); blank tiles after a corrupt WebP (`failed-import-no-tile` owns them, so this item only asserts that the corrupt WebP shows a decode error)
- **Done when:** (1) the e2e regression test above fails on main with `Unknown file format` and passes on the branch; (2) the unit tests above pass; (3) `image/webp` / `.webp` stays accepted by the picker filter and the input `accept` (`src/photo/pickPhotos.ts:9`, `src/photo/mime.ts:1,8`), covered by the existing tests; (4) patch coverage ≥ 85% (`codecov.yml` patch target), Stryker diff score ≥ 85 with zero NoCoverage (`quality/gates.json` `diffThresholds.break`), and no gate weakened or newly excluded
- **Perf:** no new work on the main thread; the decode stays in the photo worker. The existing bulk-import frame-budget scenario stays green.
- **Browser check:** on the preview URL, Add photos with a lossy and a lossless `.webp`. Both appear in the filmstrip with correct aspect thumbnails, the counter includes them, there is no error, and placing one in a frame shows the photo on the page.
- **UI kit:** `uikit/src/features/m0m1.tsx:31` and `:238-246` (`m0-photo-card`, `UI ref: uikit#/feature/m0-photo-card` — WebP listed as accepted; worker preview), `uikit/src/features/m0m1.tsx:248-256` (`editor-shell-filmstrip`, `UI ref: uikit#/feature/editor-shell-filmstrip` — progressive import thumbs). partial: dedicated WebP import / corrupt-WebP error scenario
- **Size:** ~100–180 changed lines (one guard + fixture writer + unit + e2e)
- **Source:** #41

## Done note

WebP import soft-fails EXIF size parse; fixtures + unit/e2e; Stryker 88.81
