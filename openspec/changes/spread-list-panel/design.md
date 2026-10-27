## Decisions

1. Core: `duplicateSpread(book, id, {id?})` inserts a copy (same frames/template, fresh spread id) after the source; `removeSpread` re-applies templates to spreads whose page count changed (shared helper with `addSpread`). New `BookOp` `duplicateSpread`.
2. Thumbnails: new `SpreadThumb` renders `SpreadView` from `getSpreadPaintSnapshot` + `thumbCache` only. It never touches tier registration (keyed by spreadId; would clobber the pasteboard's). Memoized; re-renders only on that spread's snapshot.
3. Virtualization: fixed row stride, reuse `pasteboardWindow`; scroll state updates only when the window changes. Thumb height via CSS var `--spreads-thumb-h`; scale = height / spreadHeightMm.
4. Navigation: pasteboard is windowed, so DOM lookup can miss. Add `requestSpreadReveal` (photoRootSession); Pasteboard subscribes and reuses the add-spread path (force-mount + `beginRevealForNewSpread`).
5. Actions: per-item `Menu` (Add after / Duplicate / Delete); keys on the listbox (↑↓, Ctrl+↵, Ctrl+D, Delete). Delete → `undoBook` Undo toast via optional `toastQueue` prop. After delete select the neighbour; stale active id falls back to first.

## Touch-set & Test Plan

- Files: `src/core/ops/{spreads,applyBookOp}.ts`, `src/core/index.ts`, `src/editor/{SpreadsPanel,SpreadThumb,spreadsPanelModel,photoRootSession,Pasteboard,EditorShell}`, `EditorShell.css`, specs `book-core`, `editor-shell`.
- Reuse: `Menu`, `IconButton`, `Toast`, `pasteboardWindow`, `thumbCache`.
- Tests: unit (ops + PBT in `bookModel`, panel model, panel RTL), e2e `spread-list-panel.spec.ts` (thumbs, click scrolls, add/duplicate/delete+undo, no page scroll).
