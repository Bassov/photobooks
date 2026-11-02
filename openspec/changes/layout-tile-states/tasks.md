## Implementation

- [x] 1. `layoutThumb.ts`: `thumbAspect`, `thumbColumns`, `thumbPaperBox` against the clamped aspect; unit tests (square, portrait clamp, landscape page, spread, past-clamp) — `src/editor/layoutThumb.test.ts`.
- [x] 2. `LayoutSection.tsx`: inline thumb `aspect-ratio`, 3 / 2 grid columns; picker test for a trim change — `LayoutSection.picker.test.tsx` "regenerates thumbnails when the trim size changes".
- [x] 3. `LayoutSection.css` + `--shadow-tile-hover` token: hover / selected / focus-visible on the paper, tile stays transparent; `docs/design.md` line.
- [x] 4. `e2e/design-r2-layout-picker.spec.ts`: new box / column / state assertions (Owner-approved design change) — 15/15 green; `design-r7-panels.spec.ts` page-1 tile size follows (r7, r10-chrome, r2-inspector, design-inspector, kit10-inspector-frame-spread, layout-picker-simplify: 30/30).

## Manual test scenarios

1. Page 1 (single page): 3 columns, paper fills each thumb; hover lifts the paper with a soft ring, click shows the 2 px ink ring.
2. Spread 2–3: 2 columns, thumbs unchanged; Tab onto a tile shows the gapped focus ring on the paper only.

`pnpm agent manual-qa` (2026-11-02):

- problem (harness): both scenarios blocked at the welcome screen — `start-session` click intercepted by the welcome `header` (known harness issue, not this change).
- OK (e2e evidence instead): scenario 1 — `design-r2-layout-picker.spec.ts` "a single page lays tiles out in 3 columns…" (85.33 px tiles, paper = 77.33 × 77.33 thumb) and "hover lifts the paper…"; scenario 2 — same spec, spread 2–3 at 131 × 69.5 / 123 × 61.5, and "keyboard focus rings the paper with a panel-colour gap, not the tile".
