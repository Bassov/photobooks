## Decisions

1. Under `#root { zoom: s }`, `clientX` and rects are viewport px, layout is app px: a viewport delta written as app px divides by `uiScale()`; rect/rect ratios stay.
2. `PanelSplitter.tsx`, `FilmstripDock.tsx` ThumbResizer: delta / `uiScale()` at the call site; `dragPanelWidth` / `thumbDragPx` unchanged.
3. `FrameContextMenu.tsx`: `parentHitAt` gets app px per mm (rect pxPerMm / s), so the 4.5 px guide radius scales with the UI (D5).
4. `Rulers.tsx`: origin, `sc` and cursor / s; canvas backing at `effectiveDpr()`.
5. `spreadPreviewKeys.ts`: `positiveDevicePixelRatio()` defaults to `effectiveDpr()`.
6. `SitePreview.tsx`: `.site` area `zoom: calc(1 / var(--ui-scale))` (net zoom 1).
7. Audit fixes (failed at 150 % before this change; no open PR holds them): `usePasteboardCamera.ts` wheel anchor, `galleryDrop.ts` `stackPoint` / `stackInset`, `SpreadsPanel.tsx` reorder drag point: screen px / s. Frame drag, resize, marquee, guide drag and crop pan passed unchanged (no #666 fixme).
8. No new tokens: existing `--ui-scale` (`styles/app.css`); the Preview bar is 48·s by app zoom.

## Touch-set & Test Plan

| File                                                                   | Why                                     |
| ---------------------------------------------------------------------- | --------------------------------------- |
| `src/ui/PanelSplitter.tsx`                                             | delta / s                               |
| `src/editor/FilmstripDock.tsx`                                         | delta / s                               |
| `src/editor/FrameContextMenu.tsx`                                      | hit radius                              |
| `src/editor/Rulers.tsx`                                                | app-px geometry, DPR × s                |
| `src/editor/spreadPreviewKeys.ts`                                      | DPR × s                                 |
| `src/editor/SitePreview.tsx`                                           | counter-zoom                            |
| `src/editor/usePasteboardCamera.ts`                                    | wheel anchor / s                        |
| `src/editor/galleryDrop.ts`                                            | drop point / s                          |
| `src/editor/SpreadsPanel.tsx`                                          | reorder point / s                       |
| `src/ui/testing/uiScaleFixture.ts`                                     | test helper: s = 1.5 via the real store |
| `src/editor/galleryDrop.stack.test.ts`                                 | unit                                    |
| `src/editor/SpreadsPanel.test.tsx`                                     | unit                                    |
| `src/ui/Panel.test.tsx`                                                | unit                                    |
| `src/editor/FilmstripDock.test.tsx`                                    | unit                                    |
| `src/editor/FrameContextMenu.test.tsx`                                 | unit                                    |
| `src/editor/Rulers.test.tsx`                                           | unit                                    |
| `src/editor/spreadPreviewKeys.test.ts`                                 | unit                                    |
| `e2e/interface-size-pointer.spec.ts`                                   | IS6 / IS8 / IS9 at 3840×2160 @150       |
| `openspec/changes/interface-size-pointer/specs/interface-size/spec.md` | delta                                   |

- Reuse: `uiScale()`, `effectiveDpr()`; fixtures `openSessionEditor`, `dispatchCtrlWheel`, `dropAssetOnFrame`.
