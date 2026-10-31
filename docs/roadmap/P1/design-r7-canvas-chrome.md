# design-r7-canvas-chrome

Tag: feature
Milestone: P1
Title: Bug: design-r7-canvas-chrome: in-canvas chrome locked to zoom, no frame size pill

## Scope

- [ ] M51: in-canvas chrome is locked to the zoom like the page numbers: the "Drop photo" / "not found" placeholder icon and label (and the crop tag, dpi and lock badges) keep a constant screen size and stay centred / anchored in their frame on every frame of a live zoom; the spread centre fold stays a 1 screen px line centred on the spread centre at every frame. No delayed re-layout, no transition.
- [ ] M52: the selected-frame size pill ("118 × 180 mm") is gone in every mode (select, drag, resize, crop); its code and CSS are removed.
- **Done when:** `e2e/design-r7-canvas-chrome.spec.ts` green with `--repeat-each=30`; the size-tag assertions in `e2e/canvas-frame-chrome.spec.ts`, `e2e/inspector.spec.ts` and `e2e/preview-no-overlays.spec.ts` read "no size tag exists"; full chromium e2e suite and the perf spec green and unchanged.
- **Browser check:** 1440×900, empty spread: ctrl-wheel zoom in and out: the 16 px icon and the 11 px "Drop photo" label never grow, shrink or jump and stay centred; the fold stays on the spread centre. Select, resize and crop a frame: no "mm" pill under it.
- **UI kit:** `uikit/src/sandbox/canvas.tsx` (`FrameBody` placeholder :75-79, gutter :435). UI ref: `uikit#/demo` steps 08 and 14–16 (kit icon 16 × 16, label 11 px, gap 4, centred; fold centred on the spread at every zoom).
- **Source:** Owner Musts, round 7, relayed by Designer 2026-11-01 (prod 68639a0).
