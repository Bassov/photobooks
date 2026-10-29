# kit10-spread-list

Tag: feature
Milestone: P1
Title: Spread list panel: kit v0.10 look (cover, endpapers, spreads, Pages / Masters)

## Scope

- [ ] Left spread list (212 px) with cover, endpapers, spreads, Pages / Masters switch and Add spread as kit v0.10.
- **Perf:** look-only change; no new subscriptions; scrolling and drag stay at 60 fps (Performance panel).
- **Browser check:** compare the product screen with the kit `#/demo` steps listed in Demo on the preview URL; no page-level H/V scroll.
- **Kit components:** `uikit#/feature/spread-list-panel` (`uikit/src/features/pages.tsx` page `spread-list-panel`); parts: `uikit/src/demo-parts/editor.tsx` (`SpreadListPart`)
- **Demo:** `uikit#/demo` steps 09 `editor-cover-selected`, 14 `editor-spread-1`, 21 `editor-masters-mode`, 23 `editor-pages-mode`, 25 `editor-endpaper-selected` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** selection `#CACACA`; Masters switch shown only if kit10-masters ships in the same cut, else disabled stub
- **Hard nos:** no fake or dead controls (a control the product cannot do yet is hidden or shown disabled with the kit look); no blue / teal; no layout shift or page-level H/V scroll; no spread reorder / context menu (removed in kit v0.10, P2 kit-first)
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** Playwright e2e on the `?fixture=` editor/library view asserting the kit structure and tokens; screenshot side by side with the kit baseline for steps 09, 14, 21, 23, 25, signed off by Designer review
- **Depends:** kit10-editor-chrome
- **UI kit:** `uikit#/feature/spread-list-panel` (`uikit/src/features/pages.tsx` page `spread-list-panel`); parts: `uikit/src/demo-parts/editor.tsx` (`SpreadListPart`)
