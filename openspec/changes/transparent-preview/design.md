## Decisions

1. Preview encode type is derived from source mime: `image/jpeg`|`image/jpg` → `image/jpeg` 0.85; `image/png`|`image/webp` → `image/webp` 0.85. Label with `blob.type` (browser may fall back to PNG).
2. Pass source `mimeType` into `buildPreview`; keep encode on the photo worker. Thumb/tier/import consumers already forward `previewMimeType` — touch only if a hard-coded jpeg remains.
3. RGBA fixture `transparent_corners.png` (opaque center, alpha=0 corners, colorType 6) via `write-sample-png.mjs`; optional RGBA WebP only if writer already exists.
4. Security: encode remains on the photo worker; mime-only blob/`createObjectURL` change; no new postMessage or permission surface.

## Touch-set & Test Plan

- Files: `src/photo/processPhoto.ts` (+ test), `e2e/fixtures/write-sample-png.mjs`, `e2e/fixtures/ensurePhotoFixtures.ts`, `e2e/filmstrip.spec.ts`; mime-path only in `tierCache`/`assetPool`/`thumbCache`/`previewAspect`/`loadPhoto`/`importPhotos` if needed
- Reuse: existing `stubImageDecodeApis` / `convertToBlob` spy; filmstrip place flow
- Tests: unit — PNG asks WebP + reports blob type; JPEG still JPEG; e2e — import transparent PNG, place, corner alpha 0 on thumb + frame (not black)
