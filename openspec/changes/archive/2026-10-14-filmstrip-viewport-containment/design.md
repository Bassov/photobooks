# Design

## Approach

Keep the existing spacer + virtualization in `Filmstrip.tsx`. Fix layout with CSS containment so the wide spacer cannot expand the CSS Grid column beyond the viewport.

## Touch-set

- `src/editor/EditorShell.css` — viewport lock on `.editor-shell`; `min-width: 0` / `min-height: 0` on grid children
- `src/editor/Filmstrip.css` — `min-width: 0`, `max-width: 100%`, `overflow: hidden` on `.filmstrip`; `max-width: 100%` on `.filmstrip-scroll`
- `src/index.css` — only if e2e still sees document overflow after shell/filmstrip rules (`width: 100%` + `overflow-x: clip` on `html, body, #root`)
- `e2e/filmstrip.spec.ts` — Playwright regression (page vs filmstrip scroll)
- `src/editor/Filmstrip.test.tsx` — spacer width + scroll overflow styles
- `src/editor/EditorShell.test.tsx` (or `App.test.tsx`) — shell overflow/width containment with seeded gallery
- Shared `seedGallery(n)` helper via public `resetBookStore` (sync seed — no rAF flush; intentional for unit layout/CSS tests)
- `openspec/specs/editor-shell/spec.md` (via delta sync on archive)
- `docs/lessons.md` — grid + wide spacer → `min-width: 0`

## Composition

No new React modules. Shell remains grid (`auto 1fr auto`); filmstrip stays the bottom row. Scrollport remains `.filmstrip-scroll`.

## Tests

| Layer       | Public surface                              | Assert                                                                                                                                  |
| ----------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| E2E         | import via file picker + `filmstrip-scroll` | `documentElement` not wider/taller than viewport; strip `scrollWidth > clientWidth`; `scrollLeft` works                                 |
| Unit        | `Filmstrip` + `enqueueGalleryAssets`        | spacer inline width = `N × (THUMB_WIDTH+8)`; filmstrip `min-width: 0` / `overflow` containment (not only status-quo `overflow-x: auto`) |
| Integration | `App` / `EditorShell` + seed                | `.editor-shell` overflow hidden/clip and width constrained; grid children `min-width: 0`                                                |

Happy-dom does not model grid min-content; page `scrollWidth` is Playwright-only.

## Decisions

- CSS-only fix; do not change spacer math or Virtualizer.
- Prefer shell `height/max-height: 100svh` + `overflow: hidden` over body-only clip so chrome stays inside the grid (progress/errors remain in the chrome row; filmstrip keyboard/focus must stay usable).
- Unit asserts target the **new** containment styles so they fail before the CSS fix.
