## Decisions

1. **Spread-wide slot.** Core `getSinglePageSide(index, count)` (page 1 `right`, single last page `left`, else `null`) and `getSpreadSlotPageCount`. Resolve stays one page wide (SpreadView gets the same resolved spread; unit tests unchanged); only placement moves.
2. **Single page on its side, canvas and list.** The pasteboard slot and the list card take the spread-wide slot; the page sits on its half; labels keep both halves. Model-side x follows: `pageShadowRects`, `buildDropIndex`, and the camera's centred width (`stackMetrics` only, one line in `usePasteboardCamera.ts`, owned by `design-r7-canvas-chrome`: `git merge origin/main` before each push). Fit is unchanged: it sizes the two-page width and never reads the gap.
3. **Labels.** `pageLabel(i, count?)` returns the single last page number.
4. **Gap.** `STACK_GAP_RATIO = 104 / 588`, the one constant behind stride, floor, window and reveal.
5. **Pill.** One threshold, `newSpreadPillFits(gapPx)` in `pageLabelsModel.ts`: pill height plus the 19 px label clearance above and below. Below it the pill is not rendered (no fade). Centred in the gap, one line, constant screen size (undoes `--cam-scale`); page numbers stay visible during a drag. Tokens (docs/design.md): `--text-xs`, `--radius-md` (kit 8 px), `--muted-foreground`, `--page-shadow`; pill height 32 px is the kit `GapDrop` `h-8` (no token).

## Touch-set & Test Plan

- Files: `src/core/geometry/spreadSize.ts`; `src/editor/{Pasteboard,PageLabels,SpreadsPanel,SpreadThumb}.tsx`, `src/editor/{pasteboardWindow,pageLabelsModel,pageShadowModel,dropTargets,editorChromePanels,usePasteboardCamera}.ts`, `EditorShell.css`; `e2e/fixtures/stackGap.ts` + M26/M36 text (gap change); new `e2e/design-r7-spreads.spec.ts`.
- Reuse: `pageLabelsFit` pattern, `stackGap` fixtures, `chooseZoom`.
- Tests: unit for side/slot, `pageLabel`, `newSpreadPillFits`, shadow and drop offsets. e2e: empty book (M45 rects), 6/8-page labels (M46), drag pill + gap at several zooms (M49). Skill `ui-review` before push.
