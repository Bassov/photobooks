## Proposal

Roadmap: `docs/roadmap/P1/thumb-scaled-decode.md` (scope / Done when / Perf SoT).

### Scope out

- Worker pool size, scheduling and DerivedCache keys (unchanged).
- HEIC / PNG / WebP decode (stay on `createImageBitmap`).

### Delta / Risk

- Chromium picks the largest DCT scale whose area fits the desired size, so the desired size is the target rounded up to the 1/8, 1/4 or 1/2 step (else 1280 would get a 750 px frame).
- Orientation: frames carry `rotation`/`flip` and draw upright; manual transform only when they report none; unknown → bitmap fallback (never twice).
