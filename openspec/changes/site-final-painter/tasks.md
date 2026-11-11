## Implementation

- [x] 1. `breakTextLines` (pre-wrap + overflow-wrap anywhere) with unit tests.
- [x] 2. `paintPage(ctx, book, page, images, pxPerMm)`: page lookup, page colour, clip, paint order, fonts.
- [x] 3. Photo frames: rect, rotation, crop / turn / flip, cover fit, frame look rings + radius, adjust filter.
- [x] 4. Text frames, captions and folios.
- [x] 5. `e2e/page-painter.spec.ts`: Vite-built harness, 4 fixtures, ΔE, line breaks, long tasks.

## Manual test scenarios

N/A — no UI consumer (the painter is not wired into the site yet); the e2e paints the 4 fixtures next to `SpreadView`.
