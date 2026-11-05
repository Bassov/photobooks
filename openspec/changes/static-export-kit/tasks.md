## Implementation

- [x] 1. `ExportSiteDialog` + `useExportRun` in `uikit/src/demo-parts/dialogs.tsx` (opts / run / done / failed, Books sentence, failure texts) — `#/feature/static-export` six states; kit typecheck + build
- [x] 2. Export site pill in `EditorTopBar` (sizer, fill, states, icon-only < 1280, status region); `DemoEditor` wiring; `EditorView` `exportSite` passthrough — scratch DOM measure (below); `uikit/scripts/qa.mjs` static-export probes (pill rect in 4 states at 1440 / 1200; dialog box); `uikit:qa:quick` 381/0
- [x] 3. Kit page `static-export` (`pages.tsx` + `pages.json`) with six states; TopBar "where" lines mention Export site — `uikit:qa:quick` page checks pass
- [x] 4. `#/demo` capture steps `export-site-options`, `export-site-running-50pct`, `export-site-running-hidden`, `export-site-done` — walk 75 steps, new steps 52–55, no page errors

## Manual test scenarios

1. `#/demo`: Export site → Choose folder… → Export → Hide → pill fills, shows "Exported", then "Export site".
2. Pill rect identical in idle / 42 % / done / failed (1440: 112.33×32; 1200: 40×32).
3. Dialog: 480 wide, padding 20/24, heading Lora 21/26.25 500, buttons 36 h r8.

- harness problem: `pnpm agent manual-qa` drives prod only (waits for `editor-shell`); kit-only change, evidence from the kit walk and a scratch Playwright DOM measure.
- OK 1: demo walk steps 52 `export-site-options` → 53 `export-site-running-50pct` (dialog "Rendering pages · 50%") → 54 `export-site-running-hidden` (pill "50%" over the fill, dialog closed) → 55 `export-site-done` (pill `data-state=done`, Site exported dialog).
- OK 2: 1440 pill x 1127.08–1127.09, w 112.33–112.34, h 32 in idle / running 42 % (`::before` rgb(190,190,190) scaleX .42) / done / failed; 1200: x 1039.42, 40×32 in every state; 6 px after Settings; accessible name "Export site" in every state.
- OK 3: dialog w 480, padding 20 24 20 24, heading Lora 21/26.25 500 rgb(57,55,56); Cancel / Export / Hide / Done / Try again 36 h r8 padding 16, 13/500; disabled Export rgb(220,220,220) / rgb(83,81,82); Choose folder… 32 h r8 padding 12 bg rgb(215,215,215); text 13/18.85 #535152, labels 12/16.8.
