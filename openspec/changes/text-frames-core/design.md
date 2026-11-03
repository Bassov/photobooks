## Decisions

1. `ResolvedItem.text` is filled per call, outside the structural memo, by a new `resolveTextContent` extracted from `resolveTextItems`.
2. Core may not import `src/render`, so the type scale lives in a new `render/textStyles.ts`. `editText` takes the whole-line `fitHeightMm` measured by the editor. It only grows the height, capped at the paper bottom, and has no coalesce key.
3. `addTextFrame` keeps `templateId`, because layouts only lay out image frames.
4. `rebindFrames` binds slots to image frames by index and appends the text frames above them.
5. The painter adds a `.spread-frame-text` node clipped to whole lines. `Empty text` shows only with a control.
6. A new `loadFonts(textStyleFonts())` calls `fontSet.load` for each style, so Lora 500 is ready before a measure.
7. Security / workers: N/A. This is pure resolve plus DOM paint.

## Touch-set & Test Plan

| Path                                 | Change         |
| ------------------------------------ | -------------- |
| `src/core/geometry/resolveSpread.ts` | text items     |
| `src/core/geometry/types.ts`         | `ResolvedText` |
| `src/core/text/resolveText.ts`       | extract        |
| `src/core/ops/frames.ts`             | 4 ops          |
| `src/core/ops/applyBookOp.ts`        | op union       |
| `src/core/ops/place.ts`              | skip text      |
| `src/core/ops/fill.ts`               | skip text      |
| `src/core/templates/apply.ts`        | images only    |
| `src/editor/bookHistory.ts`          | labels         |
| `src/render/textStyles.ts`           | new            |
| `src/render/SpreadView.tsx`          | text node      |
| `src/render/SpreadView.css`          | text node      |
| `src/fonts/loadBookFonts.ts`         | style fonts    |

Tests (unit only): ops + growth, layout apply, style table + whole lines, text render, caption size, fonts. The full e2e suite runs unchanged.
