# kit10-crop

Tag: feature
Milestone: P1
Title: Crop in frame: kit v0.10 look

## Scope

- [ ] Crop mode visuals (whole photo around the frame, crop color) as kit v0.10.
- **Perf:** look-only change; no new subscriptions; scrolling and drag stay at 60 fps (Performance panel).
- **Browser check:** compare the product screen with the kit `#/demo` steps listed in Demo on the preview URL; no page-level H/V scroll.
- **Kit components:** `uikit#/feature/crop-in-frame` (`uikit/src/features/pages.tsx` page `crop-in-frame`); parts: `uikit/src/demo-parts/editor.tsx` (`CanvasPart, InspectorPart`)
- **Demo:** `uikit#/demo` steps 19 `editor-crop-mode` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** crop overlay `--crop` `#6b696a`; Esc leaves crop, second Esc clears selection
- **Hard nos:** no fake or dead controls (a control the product cannot do yet is hidden or shown disabled with the kit look); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** Playwright e2e on the `?fixture=` editor/library view asserting the kit structure and tokens; screenshot side by side with the kit baseline for step 19, signed off by Designer review
- **Depends:** kit10-frame-selection
- **UI kit:** `uikit#/feature/crop-in-frame` (`uikit/src/features/pages.tsx` page `crop-in-frame`); parts: `uikit/src/demo-parts/editor.tsx` (`CanvasPart, InspectorPart`)
