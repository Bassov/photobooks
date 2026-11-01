## Decisions

1. Pure `frameSectionSummaries(spread, frame)` gives the adjust / style / arrange summaries from book state (`isAdjusted`, `frameStyleName` or "None", `layerOf`). The five frame Disclosures move from `Inspector.tsx` into `PhotoFrameSections` (new file) so its hook runs unconditionally; the existing `Disclosure` `summary` / `right` props render them (no `src/ui` change).
2. `FrameLockButton` (from `FrameSections.tsx`) is the POSITION & SIZE `right`; `GeometrySection` drops its lock row.
3. Slider rows reuse the M60 `fit-crop-slider--row` modifier: `InspectorSlider` gains an optional `className`, passed by Adjust; Frame rotation adds it. Spread sliders stay.
4. Kit `MmField` metrics on `.fit-crop-field` (Photo-only class): 12 px padding, 6 px gap, 12 px min prefix, left-aligned input, kit line heights. This intentionally re-aligns the Fit & crop Pan X / Y values too; M60 vertical positions stay asserted. Input font family stays (design-r11-controls lane).
5. Reset adjustments uses the ghost `Button` like "Reset to cover" (prod computes 13 px / 500 / muted / 0.5 disabled there); e2e asserts all four and a local override follows if any differs. Adjust and Frame style panels take the kit `pt-0.5 pb-3`; chip labels the 2xs 1.35 leading.

## Touch-set & Test Plan

- Files: `src/editor/PhotoFrameSections.tsx` (new), `src/editor/Inspector.tsx`, `src/editor/FrameSections.tsx`, `src/editor/FrameLookSections.tsx`, `src/editor/InspectorControls.tsx`, `src/editor/FitCropSection.css`, `src/editor/FrameSections.css`; tests `src/editor/PhotoFrameSections.test.tsx`, `src/editor/FrameSections.test.tsx`; e2e `e2e/design-r11-photo.spec.ts`.
- Reuse: `Disclosure`, `Button` ghost, tokens `--muted-foreground`, `--badge-*-fg` (docs/design.md).
- Tests: unit for summaries and the header lock; e2e per tasks 5 (ppi: no token change, both states asserted; no page scroll); CSS-only task 4 is covered by e2e; skill `ui-review` before push.
