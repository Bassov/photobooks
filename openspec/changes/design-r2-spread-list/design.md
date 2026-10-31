## Decisions

1. **One scroller (M18).** `spreads-list` stays the scrollport (testid, scroll/drag/key handlers) without `role="listbox"`. Inside: `cover-list` (Cover, front Endpaper), a "Pages" listbox of windowed spread rows, then `endpaper-back-list`. Measured head height offsets window, reveal and drag math. Cover drops `data-item` for `data-cover-row`, so `[data-item]` = spreads only.
2. **Kit card (M19).** Pure `thumbCardStyle(ratio)`: box `aspectRatio max(r,1.6)`, inner width 100% or r/1.6, `aspectRatio r`; `ThumbCard` wraps Cover (`(2w+spine)/h`) and Endpaper (`2w/h`). Spread rows keep `spreadsRowGeometry` (same numbers).
3. **No Add spread (M17).** Row "Add after" / Ctrl+Enter stay; e2e use `addSpreads` (Ctrl+Enter on a row). `editorChromeTokens.ts` only loses `.editor-add-spread`.
4. **Constant gap (M23).** Gap `min(44, 0.5·h·z)` (`pasteboardGapPx`), stride `h·z + gap`, slot padding = gap; camera Fit placement uses it; `stackContentYAtZoom` re-anchors zoom commits (reusing `zoomAtPoint`). A flat 44 px makes whole-stack fit impossible for long books (40 × 44 px > port), which the spread-view spec requires, so the gap shrinks only below an 88 px spread (past the kit's 0.25 × Fit floor at 1440×900); `stackHeightFitZoom` solves the floor for that piecewise stride. Labels `padding-top: 6px`. Deviation: kit `pt-14`/`pb-16` are content insets of a clamped scroller; the product's unclamped 2400 px world pad stays, and the Fit band `[56, H−48]` carries the 56 px top air (e2e asserts it).
5. **Labels (M24).** `pageLabelTexts(i, pages)`: page 1 `['', '1']`, single last `[2i, '']`; empty span hidden, the other spans the page.
6. No new tokens: kit item chrome `e7-item mb-1 rounded-md p-2`, `text-2xs`, 4 px spacing. `ui-review` before archive.

## Touch-set & Test Plan

- Files: `SpreadsPanel.tsx`, `EndpaperRow.tsx`, `ThumbCard.tsx`, `spreadsPanelModel.ts`, `editorChromeTokens.ts`, `pasteboardView.ts`, `usePasteboardCamera.ts`, `Pasteboard.tsx`, `PageLabels.tsx`, `pageLabelsModel.ts`, `EditorShell.css`.
- Existing e2e change selectors only (`add-spread` → `addSpreads`, `[data-item="cover"]` → `cover-list-item`), never assertions.
- Tests: unit for `thumbCardStyle`, reveal offset, `stackContentYAtZoom` / `stackHeightFitZoom` / `pasteboardGapPx` (+PBT), labels, panel DOM; e2e `design-r2-spread-list.spec.ts` (`--repeat-each=30`).
