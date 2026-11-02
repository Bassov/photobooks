## Proposal

Roadmap: [`docs/roadmap/P2/editor-hidpi-photos.md`](../../../docs/roadmap/P2/editor-hidpi-photos.md) (scope / Done when / Browser / Perf SoT).

### Scope out

- Cover / endpaper canvas and library card stay on 1280 (no on-screen size known).
- Spreads-panel thumbnails stay thumb-first; no layout or scrollport change.
- No new worker, blob-URL or CSP surface; `PERF_BUDGETS` unchanged.

### Delta / Risk

- Observables: DPR 2 natural width ≥ 2× CSS; DPR 1 and ≤ 1280 px sources stay 1280; an empty frame requests nothing.
- Risk: 2560 decodes fall inside zoom / drag LoAF windows; they rank below 1280 (see design).
