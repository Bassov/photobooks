# kit10-editor-chrome

Tag: feature
Milestone: P1
Title: Editor top bar and panels: kit v0.10 look

## Scope

- [ ] Editor top bar (Library, title, undo / redo, zoom, save status, Preview, Settings, Print, Publish; snap/grid toggles belong to `kit10-grid-snap`) and panel frame as kit v0.10.
- **Perf:** look-only change; no new subscriptions; scrolling and drag stay at 60 fps (Performance panel).
- **Browser check:** compare the product screen with the kit `#/demo` steps listed in Demo on the preview URL; no page-level H/V scroll.
- **Kit components:** `uikit#/feature/editor-chrome-toolbar` (`uikit/src/features/pages.tsx` page `editor-chrome-toolbar`); parts: `uikit/src/demo-parts/editor.tsx` (`EditorTopBar, TopBarPart, EditorView`)
- **Demo:** `uikit#/demo` steps 08 `editor-new-blank-book`, 26 `editor-preview`, 39 `editor-after-site` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** quiet header; Print / Publish / Preview buttons present only when wired, else disabled stub with kit look
- **Hard nos:** no fake or dead controls (a control the product cannot do yet is hidden or shown disabled with the kit look); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** Playwright e2e on the `?fixture=` editor/library view asserting the kit structure and tokens; screenshot side by side with the kit baseline for steps 08, 26, 39, signed off by Designer review
- **Depends:** kit10-create-book
- **UI kit:** `uikit#/feature/editor-chrome-toolbar` (`uikit/src/features/pages.tsx` page `editor-chrome-toolbar`); parts: `uikit/src/demo-parts/editor.tsx` (`EditorTopBar, TopBarPart, EditorView`)
