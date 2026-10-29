# kit10-grid-snap

Tag: feature
Milestone: P1
Title: Layout grid and snap: kit v0.10 look

## Scope

- [ ] Grid / snap toggles in the top bar, grid rendering and the master grid fields as kit v0.10.
- **Perf:** look-only change; no new subscriptions; scrolling and drag stay at 60 fps (Performance panel).
- **Browser check:** compare the product screen with the kit `#/demo` steps listed in Demo on the preview URL; no page-level H/V scroll.
- **Kit components:** `uikit#/feature/layout-grids-render-snap` (`uikit/src/features/pages.tsx` page `layout-grids-render-snap`), `uikit#/feature/layout-grids-settings` (`uikit/src/features/pages.tsx` page `layout-grids-settings`); parts: `uikit/src/demo-parts/editor.tsx` (`TopBarPart, InspectorPart`)
- **Demo:** `uikit#/demo` steps 22 `editor-master-grid-5-cols` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** toggles change the view only; values out of range clamp
- **Hard nos:** no fake or dead controls (a control the product cannot do yet is hidden or shown disabled with the kit look); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** Playwright e2e on the `?fixture=` editor/library view asserting the kit structure and tokens; screenshot side by side with the kit baseline for step 22 and the top bar in 08–26, signed off by Designer review
- **Depends:** layout-grids-schema, kit10-inspector (in-flight snapping-engine and layout-grids-snap-wire stay here, both done)
- **UI kit:** `uikit#/feature/layout-grids-render-snap` (`uikit/src/features/pages.tsx` page `layout-grids-render-snap`), `uikit#/feature/layout-grids-settings` (`uikit/src/features/pages.tsx` page `layout-grids-settings`); parts: `uikit/src/demo-parts/editor.tsx` (`TopBarPart, InspectorPart`)
