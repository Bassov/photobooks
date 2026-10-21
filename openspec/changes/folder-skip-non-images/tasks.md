## Implementation

- [x] 1. Add `isImageLikeFile` + folder `skipped` bucket in `partitionImportFiles`
- [x] 2. Plumb `ImportPhotoOptions.source` and return `skipped`; exclude skipped from `total`
- [x] 3. Pass `source:'folder'` from chrome folder paths; set polite skip status
- [x] 4. Spec deltas: photo-card + filmstrip (import folder skip summary)
- [x] 5. Unit tests: pickPhotos, importPhotos, chrome/status
- [x] 6. e2e: folder + JPEGs + README — no import-errors, skip status, count=JPEGs

## Manual test scenarios

1. Add folder with photos + README.md + .txt → no error list; status “2 non-image files skipped”; photo count = images.
2. Add photos picking README.md directly → per-file unsupported error remains.
