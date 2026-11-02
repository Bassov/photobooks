# framestyle-arrange-unhide

Tag: feature
Milestone: P2
Title: Show Frame style and Arrange in the Photo inspector again, kit look (M78)

## Scope

- [ ] Turn `FRAME_STYLE_AND_ARRANGE_VISIBLE` (`src/editor/PhotoFrameSections.tsx:38`, hidden in #389, Owner Q8 2026-11-02) back on: the Photo inspector shows FRAME STYLE (style chips, "New style from this frame", style fields) and ARRANGE (z-order buttons) again; flip the hidden-state assertions in `e2e/design-r14-hide-framestyle.spec.ts` and the specs it touched
- [ ] Both sections match the kit look (design parity finding M78): `FrameStyleSection` `uikit/src/sandbox/sections.tsx:97`, `ArrangeSection` `uikit/src/sandbox/inspector.tsx:167`; ADJUST / CAPTION / POSITION & SIZE / Delete frame keep their M72 / M76 / M81 / design-r14 values
- **Perf:** a style edit re-renders only spreads that use it; strokes and mats are borders / insets, no blurred shadows. Gate: edit a style used on 40 spreads — zero LoAF.
- **Browser check:** give all photos a white 5 mm mat via one style, change it to 3 mm — every spread updates; send a frame behind another with Arrange; the inspector has no layout shift.
- **Kit components:** `uikit#/feature/inspector` (`uikit/src/features/pages.tsx` page `inspector`); `FrameStyleSection` (`uikit/src/sandbox/sections.tsx`), `ArrangeSection` (`uikit/src/sandbox/inspector.tsx`)
- **Demo:** `uikit#/demo` steps 16 `editor-frame-selected` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** book-level frame styles; Arrange calls the same ops as today (`src/core/ops/arrange.ts`)
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** Playwright e2e for both sections on the `?fixture=` editor (visible, style edit updates every frame using it, z-order); perf scenario per RULES
- **Depends:** design-r14-hide-framestyle (switch), frame-styles (model + UI, superseded into this item)
- **UI kit:** `uikit#/feature/inspector` (`uikit/src/features/pages.tsx` page `inspector`); `FrameStyleSection` (`uikit/src/sandbox/sections.tsx`), `ArrangeSection` (`uikit/src/sandbox/inspector.tsx`)
