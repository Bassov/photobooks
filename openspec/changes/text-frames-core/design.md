## Decisions

1. `ResolvedItem.text` is filled per call, outside the structural memo, by a new `resolveTextContent` extracted from `resolveTextItems`.
2. Core may not import `src/render`, so the type scale lives in a new `render/textStyles.ts`. `editText` takes the whole-line `fitHeightMm` measured by the editor. It only grows the height, capped at the paper bottom, and has no coalesce key.
3. `addTextFrame` keeps `templateId`, because layouts only lay out image frames.
4. `rebindFrames` binds slots to image frames by index and appends the text frames above them.
5. The painter adds a `.spread-frame-text` node clipped to whole lines. `Empty text` shows only with a control.
6. A new `loadFonts(textStyleFonts())` calls `fontSet.load` for each style, so Lora 500 is ready before a measure. `fitTextHeightMm` and `loadFonts` are intentional scaffolding for `text-frames-editor` (the brief lists `loadBookFonts.ts`): unit-tested, no caller yet.
7. E2E has no Text tool yet, so a dev / fixture-only seam `dispatchBookOpForTests` (next to `setBookGridForTests`) creates text frames.
8. ui-review: a controlled text frame is labelled `Text frame`, never the photo-move wording (`Place photo`).
9. Security / workers: N/A. This is pure resolve plus DOM paint; the seam is compiled out of the deploy build.

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
| `src/editor/ConnectedSpreadView.tsx` | a11y label     |
| `src/editor/projectSession.ts`       | test seam      |
| `src/render/textStyles.ts`           | new            |
| `src/render/SpreadView.tsx`          | text node      |
| `src/render/SpreadView.css`          | text node      |
| `src/fonts/loadBookFonts.ts`         | style fonts    |
| `e2e/perf/perfFixture.ts`            | seam type      |
| `e2e/text-frames-core.spec.ts`       | new            |

Tests: unit tests for ops + growth, layout apply, style table + whole lines, text render, caption size and fonts. E2E `text-frames-core.spec.ts` covers the canvas, the list thumbnail, Preview, a layout apply that keeps the text, the caption at 3.1 mm × px/mm, `Empty text` shown only in the editor, and the viewport fit.
