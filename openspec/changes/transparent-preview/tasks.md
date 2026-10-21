## Implementation

- [x] 1. `buildPreview`: encode by source mime (JPEG→jpeg 0.85, PNG/WebP→webp 0.85); return `blob.type` as `previewMimeType`; pass source mime from `processPhotoRequest`
- [x] 2. Audit mime consumers (`importPhotos`/`thumbCache`/`tierCache`/`previewAspect`/`loadPhoto`/`assetPool`); change only hard-coded jpeg paths if any — already pass-through, no code change
- [x] 3. RGBA fixture `transparent_corners.png` in `write-sample-png.mjs` + `ensurePhotoFixtures` path
- [x] 4. Unit: PNG→webp encode request + blob type; JPEG still jpeg; update cover-scale PNG expectation
- [x] 5. e2e filmstrip: import transparent PNG, place in frame; corner alpha 0 on thumb + frame image

## Manual test scenarios

1. Preview URL → Add photos with PNG (transparent corners) → filmstrip corners show filmstrip background; place in frame → corners show page color, not black; zoom so a sharper tier loads → corners stay transparent
