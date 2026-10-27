## Decisions

1. Two pure core ops in `core/ops/fill.ts`: fill (target frame first, replaced if filled, then empty frames in frame order; extras ignored) and insert-spread-with-assets (index `spreadIndex+1`, `bestTemplateId` from photo aspect classes, overflow stays unplaced). One `dispatchBookOp` = one history step.
2. Selection: `gallerySelection` keeps the primary id plus a set; GridList `selectionMode="multiple"` (Shift/Ctrl native). Ctrl+A on filmstrip `onKeyDown` only, guarded by `isTypingTarget`; existing Esc handler extended.
3. Drag: selected item adds `ASSET_MULTI_MIME` (newline ids). Drop filters ids to current gallery, de-dupes, sorts by gallery order; unknown ignored.
4. Drop index caches gap zones at dragstart (≥16 px under each spread incl. last); allocation-free `hitTestGap` only when no frame hit. dragover only sets hover.
5. Leftovers: status "N photos left in the filmstrip".
6. UI: zone reuses `--select` outline (canvas drop token, as `.spread-frame[data-drop-hover]`), label "Drop here for a new spread"; no new token.

## Touch-set & Test Plan

- Files: core `ops/{fill,applyBookOp}.ts`, `index.ts`; editor `gallerySelection`, `Filmstrip`, `FilmstripItem`, `filmstripSelection`, `galleryDrop`, `dropTargets`, `Pasteboard`, `editorStatus`, `bookStore`, `bookHistory`; new `PasteboardGapZone.css`; specs filmstrip/pasteboard.
- Reuse: `bestTemplateId`, `photoAspectClass`, `addSpread`, `placeAsset`, `replaceAsset`, `measureHandlerSync`.
- Tests: unit (ops, id filtering, `hitTestGap`, selection); PBT (fill never changes frame count); e2e `multi-drop-fill.spec.ts` (4-grid, gap spread, 5-on-4 leftover, filled target replaced, selection keys, undo = 1 step); perf (4 photos zoomed out). Skill `ui-review` before push.
