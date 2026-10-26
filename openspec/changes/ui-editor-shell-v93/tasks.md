## Implementation

- [x] 1. Delta `editor-shell` spec: kit chrome regions + mount real pasteboard/filmstrip — `openspec/changes/ui-editor-shell-v93/specs/editor-shell/spec.md`
- [x] 2. Lock kit region testids / update failing unit+e2e expectations (red) for chrome selectors — keep `go-library`, `choose-photo-folder`, `filmstrip`, `pasteboard`, `import-progress` — `e2e/smoke.spec.ts`, unit EditorFrame/SpreadsPanel
- [x] 3. Port kit `EditorFrame` / panel frames + style module; replace shell CSS layout — `EditorFrame.tsx`, `EditorShell.tsx`, chrome CSS
- [x] 4. Port kit `TopBar` (Library back, title/save, zoom/panel toggles, quiet Preview/Export) — keep `useChromeImport` + `leaveEditorForLibrary` — `EditorTopBar.tsx`
- [x] 5. Left spreads frame + right inspector stub; dock wraps `Filmstrip`; canvas mounts `Pasteboard`; preserve checking-photos reload — `SpreadsPanel.tsx`, `FilmstripDock.tsx`, `InspectorStub.tsx`
- [x] 6. Finish unit + e2e coverage (import/place/open/back/checking-photos); update `docs/design.md`; tick roadmap scope

## Manual test scenarios

1. Library → open book → kit chrome (top / left / canvas / dock / right); no page scroll; no blue chrome
2. Choose photo folder → import progress → filmstrip place; re-open / checking-photos reload still behaves
3. Preview / Print / Publish look quiet (disabled or no-op); Library back → library; reopen book
