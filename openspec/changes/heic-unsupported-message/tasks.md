## Implementation

- [x] 1. Add `src/photo/heic.ts` (name/MIME/signature + message constant) with unit + fast-check tests; retire `mime.isHeicLikeFile`
- [x] 2. Wire partition HEIC message; extend accept/FSA lists; keep `isAcceptedPhotoMime` rejecting HEIC; reuse `isImageLikeFile`
- [x] 3. Sniff empty/octet-stream rejects in `importPhotoFilesInner`; remap decode-fail + HEIC signature in `processPhotoRequest`
- [x] 4. Spec delta `photo-card` Accepted/rejected types; e2e HEIC fixtures in `filmstrip.spec.ts`; tick roadmap Scope boxes

## Manual test scenarios

1. Add photos: `.heic` visible in filter; pick iPhone HEIC → conversion message, no tile, count unchanged
2. Extension-less HEIC (octet-stream) → same HEIC message
3. Folder with JPEGs + HEIC → JPEGs import; only HEIC message listed
