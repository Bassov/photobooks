# thumb-scaled-decode

Tag: prep
Milestone: P1
Title: Decode thumbs with ImageDecoder at reduced scale

## Scope

- [ ] Photo worker (`src/photo/processPhoto.ts`), JPEG sources when `ImageDecoder` exists and `ImageDecoder.isTypeSupported(type)` is true: read only the head (≤ 64 KiB) for SOF size and EXIF orientation; decode with `new ImageDecoder({ data: file.stream(), type, desiredWidth, desiredHeight })`, where the desired size is the target fitted to the raw (coded, pre-orientation) size; draw the `VideoFrame` on an `OffscreenCanvas` at the target size; encode WebP q0.8 as today; close frame and decoder. No full-file `arrayBuffer()` on this path. Chrome returns a frame at the nearest 1/2, 1/4 or 1/8 scale that is ≥ the desired size.
- [ ] Orientation: in the bench the drawn frame came out upright for EXIF 6 without the manual transform (the frame is already oriented, `displayWidth/Height` swapped). Verify EXIF 1/3/6/8 (and mirrored cases if fixtures exist) with `e2e/photo-orientation.spec.ts`; apply the manual transform only when the frame is not already oriented, never twice.
- [ ] Same path for the 1280 working preview (`dualTiers`, `requestTier` in `src/photo/tierCache.ts`): one decode at the desired 1280 size; thumb320 drawn from that frame.
- [ ] Fallback to the current `createImageBitmap` path for PNG / WebP / HEIC, when `ImageDecoder` is missing, or when it throws.
- **Why (decode bench 2026-10-31, Chromium 156, synthetic camera JPEG; `.local_dev/decode-bench-2026-10-31/REPORT.md` in the main checkout):** per photo, 1 worker: current 316 ms (24 MP) / 374 ms (45 MP) → `ImageDecoder` + desired size 96 / 160 ms. At 8 workers: 15.7 → 54.3 photos/s (24 MP), 5.5 → 25.0 (45 MP). `createImageBitmap` resize options do not decode at reduced scale. wasm-vips was slower than `ImageDecoder` and is rejected (no new dependency).
- **Done when:** orientation e2e green for every fixture; thumb long edge 320 and working long edge 1280 as before; one Playwright measurement on `e2e/fixtures/large-24mp.jpg`, both paths in the same browser run, shows the new thumb median ≤ 0.5× the old one (numbers in the PR body, not a CI gate); filmstrip `frame-budget gates` scenarios stay at 0 LoAF.
- **Test:** unit (desired-size math, fallback choice) + orientation e2e + a measurement script under `e2e/perf/`
- **Hard nos:** no WASM decoder; no new dependency
- **Depends:** decode-no-source-copy, decode-slot-busy-until-reply
