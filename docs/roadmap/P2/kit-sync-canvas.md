# kit-sync-canvas

Tag: feature
Milestone: P2
Title: Kit sync W1: canvas strip, page numbers, new-spread pill, size pill, K1 (Designer kit-sync Spec)
Status: done

## Scope

- [ ] KS2 (Q3, M49): `#/demo` stacks the spreads on the pasteboard (`DEMO_FEATURES.stack`); gap = 104/588 of the spread height, scales with zoom; pt-14 top, pb-16 bottom. Fit spread h 513.25 / gap 90.78, ×3 1002.45 / 177.31, min zoom 128.31 / 22.69 (`uikit/src/sandbox/viewport.tsx`)
- [ ] KS3 (M37/M42): page numbers 11 px on screen (was 12 px), 8 px under the page (was pt-2.5), hidden when the gap < 19 px
- [ ] KS4 (M49/M56): the gap does not grow during a drag; "Drop here for a new spread" pill h 32, 12 px, nowrap, width by content (199.23 at Fit), radius 8, bg white/50, centred between the page numbers and the next spread (19.89 / 19.89 at Fit, 45.42 / 45.44 at ×2), hidden when it does not fit
- [ ] KS5 (M52): remove the frame size pill "380 × 230 mm" (`uikit/src/sandbox/canvas.tsx` `Handles`)
- [ ] K1 (M43): Esc during a frame drag clears the "Release to replace" chip and the dimmed source on steps frame-drag-cancelled, crop-mode, spread-selected
- **Browser check:** `#/demo` editor: scroll the stacked spreads, zoom ×3 and to the floor, drag a filmstrip photo between spreads (pill shows, gap stays), drag a frame and press Esc (chip gone).
- **Demo:** `uikit#/demo` steps `editor-spread-1` … `editor-spread-selected` (walk in `uikit/scripts/demo-capture.mjs`)
- **Test:** kit `uikit/scripts/qa.mjs` checks KS2–KS5 and K1 on `#/demo`; demo baselines regenerated
- **Hard nos:** kit-only (`uikit/`); no `src/` change; lanes `context-inspector.tsx`, `inspector.tsx`, `templates.ts`, `index.css`, `v7.tsx`, `demo-parts/library.tsx` untouched
- **UI kit:** `uikit#/demo`; Designer Spec `photobooks-orch/shared/design/kit-sync/spec.md` items 2–5, K1
