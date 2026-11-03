## Implementation

- [x] 1. Add the same-variant `outline-solid` to every hit in design Decision 2 (site-viewer, library, slider, Credits, Shell, create-book, v7); site title button gets `data-testid="site-title-link"`. Evidence: re-grep shows no width class without `outline-solid`; DOM measure `solid 2px` on every fixed control (PR body).
- [x] 2. Extend `uikit/scripts/qa.mjs` "focus-visible outline solid on every control" to `site-viewer` (catalog, book page, Fullscreen; mouse click → no ring) and `recents-home` (library search + sort), width 2 px.

## Manual test scenarios

1. `#/feature/site-viewer`: Tab to a book → ring; open the book, Tab to Share / Fullscreen / Next spread → 2 px solid ring; click Share with the mouse → no ring.
2. `#/feature/recents-home`: Tab to Search and Sort → 2 px solid ring.
3. Tab to the Credits link, the kit index demo link and `slider-value` → 2 px solid ring; numbers go in the PR.
