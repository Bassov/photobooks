## Decisions

1. `STACK_GAP_RATIO = 44 / 588` (`pasteboardWindow.ts`): measured kit `#/demo` editor at 1440×900, Fit spread 588 px tall; kit `Stack` puts 44 px under that spread. `pasteboardGapPx(h) = h × ratio`, stride = `h + gap`. Product Fit (616 px) gets ~46 px.
2. The stack is now a uniform scale of zoom, so `zoomAtPoint`'s plain `contentY × scale` anchors exactly: drop `stackContentYAtZoom` and the `stackSpreadHeightPx` camera option.
3. `stackHeightFitZoom` = `viewport / (count × h × (1 + ratio))`, floored at 16 px spreads (`STACK_MIN_SPREAD_PX`): a readability floor for long books, independent of the gap; overscan still mounts every spread there.
4. Slot `paddingBottom` / `--slot-pad` = scaled gap. Page labels (6 px + 16 px line) render only when gap ≥ 22 px: `pageLabelsFit(gapPx)` replaces `PAGE_LABELS_MIN_ZOOM` (removed). Tokens: none new; CSS untouched (reads `--slot-pad`).

## Touch-set & Test Plan

- Files: `src/editor/pasteboardWindow.ts`, `pasteboardView.ts`, `camera.ts`, `usePasteboardCamera.ts`, `Pasteboard.tsx`, `pageLabelsModel.ts`; tests beside them incl. `PageLabels.test.tsx`; `e2e/design-r2-spread-list.spec.ts` (M23 → ratio), new `e2e/spread-gap-zoom.spec.ts`; specs `pasteboard`, `spread-view`.
- Unit/PBT: stride = h × (1 + ratio); overscan floor; fit-zoom stack fits the port; zoomAtPoint keeps a gap point's relative offset; label threshold.
- e2e: ratio within 2% at floor / Fit / zoomed in (session + 40-spread); labels in the gap at Fit, hidden at the floor; drop pill inside the gap; no page scroll. Skill `ui-review` before push.
