## Proposal

Roadmap: [`docs/roadmap/P2/page-numbers.md`](../../../docs/roadmap/P2/page-numbers.md). UI ref: `uikit#/demo` step `editor-book-page-numbers`.

### Scope out

- `src/core/` (core merged), `uikit/`, `src/render/pagerZoom*`.
- Per-spread folio hide UI (`parent-overrides`).

### Delta / Risk

- e2e: empty (Show off → no folio, "No master prints…" note), happy (Show on → folio on every page, x ±0.5 px), interact (reorder, skip first, roman, zoom).
- No page-level H/V scroll; the inspector scrolls only inside its own scrollport.
