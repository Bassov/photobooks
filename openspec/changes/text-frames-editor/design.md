## Decisions

1. **History:** `dispatchBookOp(op, key?)` overrides `coalesceKey`; a Text-tool create and its first commit share one key ("Add text"); `discardStep(key)` takes the create step back for an empty new frame (no redo entry).
2. **Editing:** `textEditStore.ts` holds the edited frame (per-spread key, so only that spread re-renders on enter / exit) and the overflow ids; the overlay textarea is uncontrolled and commits one `editText` on exit (Esc, Ctrl/⌘+Enter, blur).
3. **Text tool** is a `draw` session variant in `frameGesture.ts` (click vs drag at the existing slop); Enter-to-edit sits in `installEditorKeys` (`galleryDrop.ts`), dbl-click on the frame control.
4. **Overflow** is measured from the painted `.spread-frame-text` after `loadFonts`; chips render only in the editor overlay layer (Preview mounts none).
5. **Drops:** the drop index skips text items; a text activation target never swaps.
6. **Inspector:** a new view `text` reuses the Photo view's Geometry / Arrange disclosures and Delete row.

## Touch-set & Test Plan

| path                                 | why                                     |
| ------------------------------------ | --------------------------------------- |
| `src/editor/frameGesture.ts`         | Text draw / click, text body move       |
| `src/editor/textEditStore.ts`        | edit + overflow state, commit / discard |
| `src/editor/TextEditOverlay.tsx`     | textarea + overflow chips               |
| `src/editor/TextEditOverlay.css`     | edit / chip chrome                      |
| `src/editor/TextSection.tsx`         | Text inspector section                  |
| `src/editor/Inspector.tsx`           | `text` view                             |
| `src/editor/inspectorModel.ts`       | text target check                       |
| `src/editor/ConnectedSpreadView.tsx` | `editing`, overlay, dbl-click           |
| `src/render/SpreadView.tsx`          | `editing` control attr                  |
| `src/render/SpreadView.css`          | editing outline, hidden text            |
| `src/editor/bookStore.ts`            | key override, `discardStep`             |
| `src/editor/bookHistory.ts`          | `dropStep`                              |
| `src/editor/galleryDrop.ts`          | drop index skip, Enter edits            |
| `src/editor/dropTargets.ts`          | text target never swaps                 |
| `src/ui/icons/glyphs.ts`             | align + type glyphs                     |
| `e2e/text-frames.spec.ts`            | Done-when flows + INP                   |

- Reuse: `textNodeStyle` / `fitTextHeightMm`, `loadFonts`, `SegmentedControl`, `Disclosure`, `GeometrySection`, `ArrangeSection`, `DeleteFrameButton`; tokens from `docs/design.md` / kit (`--select`, `--field`, `--ink-warning`, `--radius-xs`).
- Tests: unit for create geometry, commit / discard history, drop index, activation, inspector view; e2e covers empty (removed frame, `Empty text`), happy (create, type, reload) and interact (keys, chip, Preview, layout, thumbnail, INP); skill `ui-review` before push.
