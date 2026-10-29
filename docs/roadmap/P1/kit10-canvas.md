# kit10-canvas

Tag: feature
Milestone: P1
Title: Canvas and pasteboard: kit v0.10 look

## Scope

- [ ] Spread or cover centered on the gray pasteboard with the status line; click on pasteboard selects the spread.
- **Perf:** look-only change; no new subscriptions; scrolling and drag stay at 60 fps (Performance panel).
- **Browser check:** compare the product screen with the kit `#/demo` steps listed in Demo on the preview URL; no page-level H/V scroll.
- **Kit components:** `uikit#/feature/pasteboard-workspace` (`uikit/src/features/pages.tsx` page `pasteboard-workspace`); parts: `uikit/src/demo-parts/editor.tsx` (`CanvasPart, EditorView`)
- **Demo:** `uikit#/demo` steps 13 `editor-cover-photo-and-title`, 14 `editor-spread-1`, 20 `editor-spread-selected` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** status line as kit; pasteboard click selects the spread
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll; keep the shipped mm rulers working, default **off** (**Owner-confirm**); their restyle is held `rulers`; no guides UI
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; pasteboard `--t-canvas` `#C8CACB` with `.canvas-dots`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** Playwright e2e on the `?fixture=` editor/library view asserting the kit structure and tokens; screenshot side by side with the kit baseline for steps 13, 14, 20, signed off by Designer review
- **Depends:** kit10-editor-chrome
- **UI kit:** `uikit#/feature/pasteboard-workspace` (`uikit/src/features/pages.tsx` page `pasteboard-workspace`); parts: `uikit/src/demo-parts/editor.tsx` (`CanvasPart, EditorView`)
