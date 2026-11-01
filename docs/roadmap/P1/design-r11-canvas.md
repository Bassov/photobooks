# design-r11-canvas

Tag: feature
Milestone: P1
Title: Bug: design-r11-canvas: spine fold, spread-list thumbnail shadow and cover text match the kit

## Scope

- [ ] M73: the canvas spine shows the kit fold instead of the 1 px line: 3 % of the spread wide (25.44 px at Fit), centred on the spine, `linear-gradient(to right, transparent, rgba(0,0,0,.06) 50%, transparent)`; it scales with the zoom in the same frame as the spread. The page shadow (`0 2px 6px .10, 0 12px 32px .14`) and continuous scroll stay as they are.
- [ ] M74: the spread-list Cover and Endpaper thumbnails take the kit `shadowSm` `0 1px 2px rgba(35,34,35,.18)` only; M45 / M46 / M55 values stay.
- [ ] M75: cover canvas text at Fit on the same cover rect: front title Lora 34 / 400 (kit width), spine 12 / 400, back 11; Back / Spine / Front labels 10 px under the cover (kit y 656.77), the Spine label from the spine's left edge (x 663.02). Sizes keep their ratio to the cover at any size.
- **Done when:** `e2e/design-r11-canvas.spec.ts` green with `--repeat-each=30`; M49 / M51 / M56 / M26 / M39 / M44 specs, full chromium e2e suite and the perf spec green.
- **Browser check:** 1440 × 900, 19 × 23 book: an interior spread at Fit and 200 %, then the cover with title "Lake trip 2026"; values within 0.5 px of `uikit#/demo` steps `editor-spread-1` and `editor-cover-photo-and-title`.
- **UI kit:** `uikit/src/sandbox/canvas.tsx` (fold :435), `uikit/src/sandbox/v7.tsx` (`shadowSm` :51, `CoverSpread` :62), `uikit/src/sandbox/viewport.tsx` (`PageLabels` :14). UI ref: `uikit#/demo`.
- **Source:** Owner Must relayed by the Designer, round 11 (Designer review r10 of prod, 2026-11-01). Owner rule: every Designer item is a Must; round 11, Designer review r10 2026-11-01.
