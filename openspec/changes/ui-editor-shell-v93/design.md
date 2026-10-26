## Decisions

1. Port kit `EditorFrame` + `TopBar` + spreads/dock chrome frames into `src/editor/` (copy JSX; never import `uikit/src/**`). Mount existing `Pasteboard` / `ConnectedSpreadView` / `Filmstrip` / `useChromeImport` as canvas + dock. Tokens/primitives: `--chrome` / `--canvas` / `--select` / `--color-sel`, `Button`, `Icon`, `IconButton`, `Status`, `Menu` (`docs/design.md`).
2. Replace flat grid shell with kit regions: top bar, left spreads frame, center canvas (`Pasteboard`), bottom dock (`Filmstrip`), right inspector stub (no kit inspector crop — crop stays on current pasteboard/filmstrip paths; Package J). Panel collapse via kit toggles only if cheap (boolean show/hide; no drag-resize).
3. Keep product testids e2e/unit lock (`editor-shell`, `go-library`, `choose-photo-folder`, `filmstrip`, `pasteboard`, `import-progress`, …); add kit region testids (`editor-bar`, `panel-l`/`panel-b`/`panel-r`, `canvas`, `dock`) without dropping import/place/checking-photos/open/back coverage.
4. Preview / Export / Publish / Print are look-only (disabled or quiet no-op; in-app Preview deferred with backends). Library → `leaveEditorForLibrary`. Status line for import/save (no new folder/filmstrip toasts). Preserve checking-photos reload behavior.
5. Delta `editor-shell` layout requirement only; filmstrip/pasteboard/session contracts unchanged.

## Touch-set & Test Plan

- Files: `EditorShell.tsx` / `EditorTopBar.tsx` / `EditorShell.css` (+ chrome style module), spreads/dock frames, `docs/design.md` Editor shell row, unit + e2e selector updates, OpenSpec `editor-shell` delta.
- Reuse: `useChromeImport`, `bookStore`, `projectSession`, `Pasteboard`, `Filmstrip`, `src/ui` primitives, Theme B tokens.
- Tests: unit shell regions + Library back + import wiring; e2e open/import/place/checking-photos reload/back; scrollport + `assertDocumentFitsViewport`; skill `ui-review` before push.
