# kit10-inspector-frame-spread

Tag: feature
Milestone: P1
Title: Inspector frame and spread: kit v0.10 look

## Scope

- [ ] Right inspector (300 px) following the selection: Frame and Spread contexts as kit v0.10. Keep the shipped Layout (templates), Geometry (incl. lock + frame rotation) and Arrange sections and restyle them to the kit (Designer call B3).
- **Perf:** look-only change; no new subscriptions; scrolling and drag stay at 60 fps (Performance panel).
- **Browser check:** compare the product screen with the kit `#/demo` steps listed in Demo on the preview URL; no page-level H/V scroll.
- **Kit components:** `uikit#/feature/inspector` (`uikit/src/features/pages.tsx` page `inspector`); parts: `uikit/src/demo-parts/editor.tsx` (`InspectorPart`), `uikit/src/components/ui/numberfield.tsx` (`NumberField`)
- **Demo:** `uikit#/demo` steps 16 `editor-frame-selected`, 20 `editor-spread-selected` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** nothing selected shows spread properties; shipped Layout / Geometry (lock, frame rotation) / Arrange keep working, restyled
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll; do not remove shipped behavior; hide kit sections the product has no behavior for: Caption, Frame style, Adjust, Rotate & flip, Align & distribute, Save as template / My templates (Adjust / Flip are not planned: `DEFERRED.md`)
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** Playwright e2e on the `?fixture=` editor/library view asserting the kit structure and tokens; screenshot side by side with the kit baseline for steps 16, 20, signed off by Designer review
- **Depends:** ui-primitives-forms, kit10-frame-selection
- **UI kit:** `uikit#/feature/inspector` (`uikit/src/features/pages.tsx` page `inspector`); parts: `uikit/src/demo-parts/editor.tsx` (`InspectorPart`), `uikit/src/components/ui/numberfield.tsx` (`NumberField`)
