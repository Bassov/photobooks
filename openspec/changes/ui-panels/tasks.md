## Implementation

- [ ] 1. `src/ui/panelSize.ts`: pure clamp/step + load/save (localStorage, safe fallback) with unit + property tests
- [ ] 2. `src/ui/Panel.tsx` (+css): `Panel` with header (title, collapse button) and body; tests
- [ ] 3. `src/ui/PanelSplitter.tsx`: `role=separator` pointer + keyboard resize (arrows, Shift ×4, Enter collapse); tests
- [ ] 4. Wire `EditorFrame` left/right regions: width via `--panel-left` / `--panel-right`, splitters, persisted per browser; keep `data-open` / inert contract
- [ ] 5. Specimen section `specimen-panels` + e2e (resize, persist across reload, collapse) and specimen baseline

## Manual test scenarios

1. Drag the left splitter: width clamps at 150–360 px; reload keeps it.
2. Focus a splitter, ArrowRight/Left (Shift ×4), Enter collapses; `[` / `]` reopen.
3. No page-level scroll at any panel size.
