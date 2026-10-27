## Implementation

- [x] 1. `src/ui/panelSize.ts`: pure clamp/step + load/save (localStorage, safe fallback) with unit + property tests
- [x] 2. `src/ui/Panel.tsx` (+css): `Panel` with header (title, collapse button) and body; tests
- [x] 3. `src/ui/PanelSplitter.tsx`: `role=separator` pointer + keyboard resize (arrows, Shift ×4, Enter collapse); tests
- [x] 4. Wire `EditorFrame` left/right regions: width via `--panel-left` / `--panel-right`, splitters, persisted per browser; keep `data-open` / inert contract
- [x] 5. Specimen section `specimen-panels` + e2e (resize, persist across reload, collapse) and specimen baseline

## Manual test scenarios

1. Drag the left splitter: width clamps at 150–360 px; reload keeps it.
2. Focus a splitter, ArrowRight/Left (Shift ×4), Enter collapses; `[` / `]` reopen.
3. No page-level scroll at any panel size.

`pnpm agent manual-qa` (2026-10-27): problem — all 3 scenarios stopped before the editor: the rig harness clicks the hidden `start-session` button, which the welcome header intercepts (rig-side; WelcomeScreen untouched here). Evidence instead from Playwright (`e2e/ui-panels.spec.ts`, real Chromium):

- OK 1 — `page.mouse` drag clamps to 150 then 360; width 360 survives reload.
- OK 2 — ArrowRight + Shift+ArrowRight = 252 px, persists across reload; Enter collapses and focus lands on `toggle-l`; header collapse focuses `toggle-r`. `[` / `]` reopen is unit-covered (`EditorFrame.test.tsx`).
- OK 3 — both panels at 360 on the 40-spread fixture: `assertDocumentFitsViewport` passes and `spreads-list` is the vertical scrollport.
