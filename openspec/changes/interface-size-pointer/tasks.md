## Implementation

- [x] 1. PanelSplitter and filmstrip separator: pointer delta / `uiScale()` (unit tests at s = 1.5). — `src/ui/Panel.test.tsx`, `src/editor/FilmstripDock.test.tsx`
- [x] 2. FrameContextMenu: app-px `pxPerMm` for the parent hit radius (unit test at s = 1.5). — `src/editor/FrameContextMenu.test.tsx`
- [x] 3. Rulers: origin / scale / cursor in app px; canvas backing at `effectiveDpr()` (unit test). — `src/editor/Rulers.test.tsx`
- [x] 4. `positiveDevicePixelRatio()` defaults to `effectiveDpr()` (unit test). — `src/editor/spreadPreviewKeys.test.ts`
- [x] 5. SitePreview `.site` counter-zoom `calc(1 / var(--ui-scale))`. — e2e `site preview` case
- [x] 6. `e2e/interface-size-pointer.spec.ts`: IS6 gestures ±1 px, IS8 rulers backing, IS9 Preview bar / room / GL DPR at 3840×2160 @150 (and @100); audit fixes in `usePasteboardCamera.ts`, `galleryDrop.ts`, `SpreadsPanel.tsx` (unit tests in `galleryDrop.stack.test.ts`, `SpreadsPanel.test.tsx`). No #666 case needed `test.fixme`.

## Manual test scenarios

1. 3840×2160, choice 150: drag the left panel splitter 40 px → panel edge follows the pointer.
2. Same: open Preview → bar 72 px, site room at visitor size.
