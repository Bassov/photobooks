# static-export-kit

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item static-export-kit

## Scope

- [ ] `uikit/src/demo-parts/dialogs.tsx`: new `ExportSiteDialog` (steps `opts | run | done | failed`; props `title`, `otherBooks`, `folder?`, `initialStep`, `onHide`; `AppModal` 480, dismissable in `run`; Hide, no Cancel while running) — local export to a folder, no hosting, no Publish wording (Designer spec `static-export/spec.md` §2)
- [ ] `uikit/src/demo-parts/editor.tsx` `EditorTopBar`: "Export site" pill after Settings (`data-testid="demo-export-site"`), order Preview · Settings · Export site · Print · Publish; hidden sizer keeps 112.33 wide in every state; running = `::before` fill `scaleX(p)` + `NN%`; done = "Exported" for 4000 ms; failed = "Failed" until the dialog is opened; icon-only 40×32 below a 1280 px viewport. `DemoEditor` holds the dialog and the pill state; Hide keeps the pill running (spec §1)
- [ ] `uikit/src/features/pages.tsx` + `uikit/src/kit/pages.json`: new page `static-export` with states `opts-empty`, `opts`, `run`, `run-hidden`, `done`, `failed`; TopBar "where" lines mention Export site
- [ ] `uikit/scripts/demo-capture.mjs`: steps `export-site-options`, `export-site-running-50pct`, `export-site-running-hidden`, `export-site-done` after `publish-done`
- **Done when:** DOM: the pill rect is identical (±0.5) in idle, run 42 %, done and failed, 112.33×32 (40×32 below 1280); the dialog is 480 wide, padding 20/24, heading Lora 21/26.25 500, buttons 36 h r8; kit typecheck, build and `uikit:qa:quick` pass; Designer review of the PR against the spec
- **Browser check:** kit `#/demo`: Export site → Choose folder → Export → Hide → the pill fills to 100 %, shows "Exported", then "Export site"; `#/feature/static-export` states
- **Hard nos:** kit lane only, no prod `src/` edits (the prod pill is item `static-export`); no hosting / Publish / upload wording; no layout shift; no blue / teal
- **UI kit:** `uikit#/feature/static-export`; parts: `uikit/src/demo-parts/dialogs.tsx` (`ExportSiteDialog`), `uikit/src/demo-parts/editor.tsx` (`EditorTopBar`)
- **Test:** kit typecheck / build / `uikit:qa:quick` and the `#/demo` capture walk pass; DOM measurements (scratch Playwright under `.cache/agent/`) recorded in the PR; no prod tests
