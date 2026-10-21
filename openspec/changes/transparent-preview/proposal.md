## Proposal

Roadmap: `docs/roadmap/M2.2/transparent-preview.md` (scope / Done when / Browser / Perf SoT).

### Scope out

- PDF/print compositing (M6)
- Checkerboard filmstrip styling
- Decode-failure / onError paths from failed-import-no-tile

### Delta / Risk

- `buildPreview` encodes JPEG→JPEG 0.85, PNG/WebP→WebP 0.85 (alpha kept); return `blob.type` as `previewMimeType`
- e2e: import RGBA PNG, place in frame; corner alpha 0 (not `rgb(0,0,0)`) on thumb + frame
- Security: encode stays on the photo worker; only preview blob mime changes; no new postMessage trust boundary
