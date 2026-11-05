## Proposal

Roadmap: `docs/roadmap/P3/site-lightbox.md` (scope / Done when / Browser / Perf SoT). UI ref: `uikit#/feature/site-lightbox`; Designer spec `site-lightbox` §6–§7.

### Scope out

- `uikit/`, `SpreadView`, `src/core/**`, derivatives, site export; no Fullscreen API, history entry or click-outside close.

### Delta / Risk

- UI: happy path on `site.html?book=alps` (open, step, zoom, close) plus 390×844 touch; empty N/A (a book always has a cover slide). No page-level H/V scroll: the lightbox is `fixed inset-0`, `html { overflow: hidden }` while open.
- Presentation mode unchanged (default variant).
