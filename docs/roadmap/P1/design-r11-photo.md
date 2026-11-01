# design-r11-photo

Tag: feature
Milestone: P1
Title: Bug: design-r11-photo: Photo inspector expanded sections match the kit
Status: done

## Scope

- [ ] M72 ADJUST: slider rows on the kit `SliderRow` pitch (35.8, first row at dy 28.25 from the title); "Reset adjustments" at dy 135.64, 13 px / 500 / rgb(83, 81, 82), half opacity while there is nothing to reset.
- [ ] M72 POSITION & SIZE: the lock button sits on the section title row (kit x 1404, 28 px); X / Y fields at dy 34.83 (W / H 74.83, Frame rotation 116.45); X / Y / W / H, ∠ and Pan X / Y values left-aligned right after the 12 px prefix (kit 12 px field padding, 6 px gap).
- [ ] M72 collapsed summaries from real state: FRAME STYLE shows the frame's style name ("None" without one), ARRANGE shows `z <layer>` and follows Bring forward / Send backward; ADJUST shows "Edited" once adjusted, like the kit. 12 px / 400 / rgb(83, 81, 82), right-aligned on the title row.
- [ ] M72 ppi chip: success text rgb(57, 55, 56) at print quality (kit 401 dpi chip); low / too-low chips keep the kit warning / error tokens.
- [ ] M60 values unchanged (PHOTO 105.75 × 1172, FIT & CROP 272.39, ROTATE & FLIP 495.19, Straighten 607.44, Quarter turn 643.23, 37 px collapsed pitch).
- **Done when:** `e2e/design-r11-photo.spec.ts` green with `--repeat-each=30`; `design-r10-inspectors` and earlier photo specs stay green; full chromium e2e suite and the perf spec green.
- **Browser check:** 1440 × 900, filled frame selected: expand ADJUST, POSITION & SIZE, FRAME STYLE, ARRANGE one at a time and collapsed; positions within 0.5 px of `uikit#/demo` step `editor-frame-selected`; draw two frames, Bring forward, ARRANGE summary reads `z 2`.
- **UI kit:** `uikit/src/sandbox/inspector.tsx` (`GeometrySection` :79, `ArrangeSection` :167, `AdjustSection` :273, `MmField` :24), `uikit/src/sandbox/sections.tsx` (`FrameStyleSection` :97), `uikit/src/components/app/ui.tsx` (`Section` :62). UI ref: `uikit#/demo`.
- **Source:** Owner Must M72 relayed by the Designer, round 11 (Designer review r10 of prod, 2026-11-01). Owner rule: every Designer item is a Must; round 11, Designer review r10 2026-11-01.
