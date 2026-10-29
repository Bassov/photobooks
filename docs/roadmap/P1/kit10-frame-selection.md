# kit10-frame-selection

Tag: feature
Milestone: P1
Title: Frame selection and move: kit v0.10 look

## Scope

- [ ] Selected frame handles, mid-drag and Esc-cancel visuals as kit v0.10.
- **Perf:** look-only change; no new subscriptions; scrolling and drag stay at 60 fps (Performance panel).
- **Browser check:** compare the product screen with the kit `#/demo` steps listed in Demo on the preview URL; no page-level H/V scroll.
- **Kit components:** `uikit#/feature/frame-selection-handles` (`uikit/src/features/pages.tsx` page `frame-selection-handles`); parts: `uikit/src/demo-parts/editor.tsx` (`CanvasPart`)
- **Demo:** `uikit#/demo` steps 16 `editor-frame-selected`, 17 `editor-frame-mid-drag`, 18 `editor-frame-drag-cancelled` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** canvas selection `#232223` with white handles only; Esc mid-drag restores the frame
- **Hard nos:** no fake or dead controls (a control the product cannot do yet is hidden or shown disabled with the kit look); no blue / teal; no layout shift or page-level H/V scroll; no rotate handle (photo-rotate is P2)
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** Playwright e2e on the `?fixture=` editor/library view asserting the kit structure and tokens; screenshot side by side with the kit baseline for steps 16–18, signed off by Designer review
- **Depends:** kit10-canvas
- **UI kit:** `uikit#/feature/frame-selection-handles` (`uikit/src/features/pages.tsx` page `frame-selection-handles`); parts: `uikit/src/demo-parts/editor.tsx` (`CanvasPart`)
