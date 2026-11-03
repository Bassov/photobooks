## Implementation

- [x] 1. Resolve text items in `resolveSpread` (`ResolvedItem.text`) via a shared `resolveTextContent`. Evidence: `src/core/geometry/resolveSpread.text.test.ts`.
- [x] 2. Ops `addTextFrame`, `editText` (grow to fit, capped at paper bottom), `setTextStyle`, `setTextAlign` in `frames.ts` + `applyBookOp`; history labels. Evidence: `src/core/ops/textFrames.test.ts`, `src/editor/bookHistory.test.ts` ("names the text frame steps").
- [x] 3. Photo ops (place / replace / swap / fill) skip text frames. Evidence: `textFrames.test.ts` "photo ops skip text frames".
- [x] 4. `rebindFrames` / `withLayout`: image frames only; text frames kept above, relative order kept. Evidence: `src/core/templates/apply.text.test.ts` (built-in + saved layout), `LayoutSection.saved.test.tsx`.
- [x] 5. `render/textStyles.ts` (style table, whole-line height, CSS) + `loadFonts`. Evidence: `src/render/textStyles.test.ts`, `src/fonts/bookFonts.test.ts` "loadFonts".
- [x] 6. `SpreadView` text node (`data-kind="text"`, whole lines, `Empty text` editor-only) and caption font-size 3.1 mm × px/mm. Evidence: `src/render/SpreadView.text.test.tsx`, `SpreadView.look.test.tsx`.

Stay green unchanged: `src/editor/editorHardNos.test.ts:36`, `src/core/text/textFrame.test.ts:184`, `e2e/design-r2-canvas-toolbar.spec.ts:101`, `e2e/design-r2-toolbar-kitset.spec.ts:18`.

## Manual test scenarios

1. A `?fixture=` book with a text frame shows its text on the canvas, in the list thumbnail and in Preview.
2. Applying a layout to that spread keeps the text box above the photos.
3. A photo caption grows and shrinks with the zoom (3.1 mm × px/mm).
