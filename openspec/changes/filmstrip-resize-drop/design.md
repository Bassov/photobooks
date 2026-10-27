## Decisions

1. Thumb height becomes a persisted store (`filmstripSize.ts`, localStorage, clamp 64–192, default 96). `thumbSlotSize`/prefix/spacer helpers take `height` (default 96; width clamp scales 0.5h–3h, so defaults are unchanged).
2. Dock gets a top-edge splitter (`role=separator`, ↑/↓, pointer drag) plus a range slider in the dock head. During drag only CSS var `--film-preview-scale` is written on the dock (a scale transform only: no layout, no React/virtualizer work, the preview is clipped to the old dock height; mid-gallery LoAF e2e gate holds); on release the store commits once and the virtualizer re-lays out.
3. Desktop drop: dock `dragover/drop` accepts external `Files` drags (ignores `ASSET_DRAG_MIME`), resolves `getAsFileSystemHandle()`; directory → `chromeImport.onDropPhotoFolder` (same path as Choose folder incl. replace confirm). Loose files → status "Drop a folder — Photobooks adds folders, not single photos". Hover uses `data-drop-hover`.
4. Security: read-only directory handles only; files/other handles rejected.

## Touch-set & Test Plan

- Files: `src/editor/filmstripSize.ts` (new), `thumbSlotSize.ts`, `Filmstrip.tsx`, `FilmstripItem.tsx`, `FilmstripDock.tsx`, `Filmstrip.css`, `EditorShell.tsx`, `useChromeImport.tsx`, `filmstripDropFolder.ts` (new), `openspec/specs/filmstrip/`.
- Reuse: `dropHover`, `importPickedFolder`, `editorStatus`, ui primitives.
- Tests: unit (size store clamp/persist, slot sizing, drop classification), component (splitter keys, drop), e2e (resize mid-gallery, drop).
