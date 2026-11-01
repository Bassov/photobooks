## Implementation

- [x] 1. `src/photo/scaledDecode.ts`: JPEG + `ImageDecoder.isTypeSupported` → 64 KiB head (SOF + EXIF), `ImageDecoder` over `file.stream()` at the desired size (scale-step math), residual orientation from frame `rotation`/`flip`; unit tests in `scaledDecode.test.ts` (17 green).
- [x] 2. `processPhotoRequest`: scaled path first (thumb or dual 1280 + 320 from one frame, frame closed, `returnSource` still reads the body), `createImageBitmap` fallback when not applicable or on throw; `processPhoto.test.ts` `processPhotoRequest with ImageDecoder` (6 green).
- [x] 3. `e2e/photo-orientation.spec.ts`: EXIF 1/3/6/8 corner-colour check on the thumb and the 1280 frame image (new EXIF 1 fixture); 4/4 green, and 3/6/8 fail when the frame transform is applied twice (local mutation run).
- [x] 4. `e2e/perf/thumb-decode.spec.ts` + test-build hook `window.__photobooksDecode`: both paths on `large-24mp.jpg` in one run; thumb median 73 → 20 ms (0.27×), dual 127 → 66 ms; tier edges 320 / 1280 asserted.

## Manual test scenarios

N/A: worker decode only; no UI change. Proof is the orientation e2e (real browser decode) and the `e2e/perf/thumb-decode.spec.ts` measurement.
