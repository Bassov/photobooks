## Decisions

1. M35 cause (DOM-measured): at rest the spread's `box-shadow` already is the kit `--page-shadow`; the slot's paint containment (`contain: paint`, `content-visibility: auto`) clipped its 32 px blur into a hard band. Fix: `overflow-clip-margin: 48px` (≥ 12 + 32 px reach); Chromium takes no `calc()` there, so a live zoom gesture drops the paint clip instead.
2. Owner-approved deviation (2026-10-31): gap 72/588. `STACK_GAP_RATIO` = 72 / 588, still zoom-scaled; `pt-14` unchanged.
3. M37: labels anchor at the page bottom (`top: 100% − --slot-pad + 8px`), 11 px font, `line-height: 1`; never a fraction of the gap. Mid-gesture the camera writes `--cam-scale` (world scale) on the world; label offset/font and the page shadow divide by it; settle removes it.
4. Hide threshold = offset + line = 8 + 11 = 19 px (was 6 + 16 = 22), so a label never overlaps the next spread; it still hides on long books at the floor.
5. At 18 % the gap (≈27 px) is shorter than the 44 px reach; the shadow stays kit-constant, its faint tail fading under the next spread. Tokens: `--page-shadow` now composes `--page-shadow-near` / `-far` (same value; `docs/design.md`), labels use `--text-2xs`.

## Touch-set & Test Plan

- Files: `EditorShell.css`, `SpreadView.css`, `styles/tokens.css`, `pasteboardWindow.ts`, `pageLabelsModel.ts`, `usePasteboardCamera.ts` (2 lines).
- Reuse: `e2e/fixtures/stackGap.ts` (`KIT_GAP_RATIO` → `STACK_GAP_RATIO`).
- Unit: `PageLabels.test.tsx` (19 px), `cameraGesture.test.tsx` (`--cam-scale`), 72 / 588 in `pasteboardWindow` / `pasteboardView` / `Pasteboard.reveal`.
- e2e: `design-r3-spread-shadow.spec.ts` (18 %, Fit, 138 %, mid-gesture, kit `shadow-page`); `spread-gap-zoom`, `design-r2-spread-list`.
