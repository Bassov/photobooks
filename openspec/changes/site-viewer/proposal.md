## Proposal

Roadmap: `docs/roadmap/P3/site-viewer.md` (scope / Done when / Browser / Perf SoT). UI ref: `uikit#/feature/site-viewer`.

### Scope out

- Fullscreen and slide motion (`site-lightbox`); site settings UI.
- Writing the tree to disk, bundle and fonts in it (`static-export-writer`).

### Delta / Risk

- e2e: empty catalog line; catalog → book → slide labels; step / Share. No page-level H/V scroll at any width; fixed-size stage, no inner scrollport.
- Security: exported `#site-data` escapes `<` and carries asset ids only.
