## Decisions

1. **Selection:** Filmstrip / template / spreads use `#CACACA` fill only (`ring-0`, no black ring-select). Gray a11y focus OK. Canvas frame pressed/focus keeps `--select` (#232223) outline + handles.
2. **Place/replace:** Remove “Replace photo” / click-gallery place-replace. Filmstrip drag place/replace only. Move/swap/unplace unchanged. No picker modal.
3. **Camera:** Plain wheel zooms to pointer (Ctrl/Cmd still ok). Space = pan only — ignore panel hotkeys while held; `data-panning` suppresses canvas focus ring (reuse I’s keys/`EditorFrame`).
4. **Cursors / status / badges:** Port kit outlined CSS for select + grab pan. Folder/filmstrip msgs → `setEditorStatus` only (keep import-error Show-files toast). Used badges black/ink.
5. **Tokens doc:** Update `docs/design.md` Migration “Editor hard-nos” row when shipped; skill `ui-review` before push.

## Touch-set & Test Plan

- Files: filmstrip/template/spreads chrome CSS+items; `frameSelection`/`galleryDrop`/`ConnectedSpreadView`; `usePasteboardCamera`; chrome keys/tokens; status callers; `docs/design.md`. Copy kit cursor SVGs into `src/` (no `uikit/src` import). Specs: pasteboard, spread-view, filmstrip, editor-shell.
- Reuse: Package I `EditorFrame` / `installEditorChromeKeys` / `e7-item` / `data-panning`.
- Tests: unit — tone CSS, Space blocks panels, plain wheel zoom, no Replace label, black badge, status-not-toast; e2e empty/happy drag place + Space + wheel + no page scroll; `ui-review` before push.
