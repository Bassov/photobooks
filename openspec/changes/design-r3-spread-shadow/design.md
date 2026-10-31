## Decisions

1. M35 cause (DOM-measured): at rest the spread's `box-shadow` already is the kit `--page-shadow`; the slot's paint containment (`contain: paint`, `content-visibility: auto`) clipped its 32 px blur into a hard band, and a live zoom gesture scaled it with the world (it jumped). Fix: the pasteboard spreads paint no shadow; an unscaled `PageShadows` layer under the world (sibling inside `pasteboard-scroll`, world `position: relative` paints over it) holds one box per mounted spread with the kit `--page-shadow`. Its world-local rect (`pageShadowRects`: slot × stride, centred in the stack width) maps through the camera frame in CSS: `origin + --cam-tx + --cam-scale × u`, size × `--cam-scale`. So blur and offset never scale, the box follows the page edge, and no JS runs per shadow per frame. Rejected: counter-scaling the shadow inside the world (still inside the transform; Designer).
2. Owner-approved deviation (2026-10-31): gap 72/588. `STACK_GAP_RATIO` = 72 / 588, still zoom-scaled; `pt-14` unchanged.
3. M37: labels anchor at the page bottom (`top: 100% − --slot-pad + 8px`), 11 px font, `line-height: 1`; never a fraction of the gap. Mid-gesture the camera writes the frame (`--cam-tx`, `--cam-ty`, `--cam-scale`) on `pasteboard-scroll`; the shadow layer maps through it, label offset/font divide by the scale; settle removes all three.
4. Hide threshold = offset + line = 8 + 11 = 19 px (was 6 + 16 = 22), derived in `pageLabelsModel`, so a label never overlaps the next spread. At 72 / 588 that is a 155 px spread: Fit and 138 % keep labels; the 3-spread floor (gap 18 px at 1440 × 900) and long books at the floor hide them.
5. At 18 % the gap (≈27 px) is shorter than the 44 px reach; the shadow stays kit-constant, its faint tail fading under the next spread (the world paints over the layer). Kit token unchanged; labels use `--text-2xs`.

## Touch-set & Test Plan

- Files: `EditorShell.css`, `Pasteboard.tsx` (layer mount), `PageShadows.tsx`, `pageShadowModel.ts`, `pasteboardWindow.ts`, `pageLabelsModel.ts`, `usePasteboardCamera.ts` (frame vars on the scroller).
- Reuse: `e2e/fixtures/stackGap.ts` (`KIT_GAP_RATIO` → `STACK_GAP_RATIO`).
- Unit: `pageShadowModel.test.ts`, `PageLabels.test.tsx` (19 px), `cameraGesture.test.tsx` (`--cam-*` frame), 72 / 588 in `pasteboardWindow` / `pasteboardView` / `Pasteboard.reveal`.
- e2e: `design-r3-spread-shadow.spec.ts` (18 %, Fit, 138 %, mid-gesture, 8 + 8 Ctrl+wheel steps, kit `shadow-page`); `spread-gap-zoom`, `design-r2-spread-list`, `design-r3-chrome`.
