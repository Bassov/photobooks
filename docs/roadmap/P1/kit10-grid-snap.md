# kit10-grid-snap

Tag: feature
Milestone: P1
Title: Layout grid and snap: kit v0.10 look

## Scope

- [ ] Grid / snap toggles in the top bar, grid rendering and the spread Layout grid section as kit v0.10.
- **Perf:** look-only change; no new subscriptions; scrolling and drag stay at 60 fps (Performance panel).
- **Browser check:** compare the product screen with the kit `#/demo` steps listed in Demo on the preview URL; no page-level H/V scroll.
- **Kit components:** `uikit#/feature/layout-grids-render-snap` (`uikit/src/features/pages.tsx` page `layout-grids-render-snap`), `uikit#/feature/layout-grids-settings` (`uikit/src/features/pages.tsx` page `layout-grids-settings`); parts: `uikit/src/demo-parts/editor.tsx` (`TopBarPart, InspectorPart`)
- **Demo:** `uikit#/demo` steps 14 `editor-spread-1` (top bar toggles), 20 `editor-spread-selected` (spread Layout grid section, `SpreadGridSection`) (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** toggles change the view only; values out of range clamp
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** Playwright e2e on the `?fixture=` editor/library view asserting the kit structure and tokens; screenshot side by side with the kit baseline for steps 14, 20, signed off by Designer review
- **Depends:** kit10-inspector-frame-spread
- **UI kit:** `uikit#/feature/layout-grids-render-snap` (`uikit/src/features/pages.tsx` page `layout-grids-render-snap`), `uikit#/feature/layout-grids-settings` (`uikit/src/features/pages.tsx` page `layout-grids-settings`); parts: `uikit/src/demo-parts/editor.tsx` (`TopBarPart, InspectorPart`)
