# kit10-masters

Tag: feature
Milestone: P1
Title: Masters mode: kit v0.10 look

## Scope

- [ ] Spread list Pages / Masters switch, master A / B on canvas and in the inspector as kit v0.10; stub where parent-spreads behavior is missing.
- **Perf:** look-only change; no new subscriptions; scrolling and drag stay at 60 fps (Performance panel).
- **Browser check:** compare the product screen with the kit `#/demo` steps listed in Demo on the preview URL; no page-level H/V scroll.
- **Kit components:** `uikit#/feature/parent-spreads` (`uikit/src/features/pages.tsx` page `parent-spreads`); parts: `uikit/src/demo-parts/editor.tsx` (`SpreadListPart, InspectorPart`)
- **Demo:** `uikit#/demo` steps 21 `editor-masters-mode`, 22 `editor-master-grid-5-cols`, 23 `editor-pages-mode` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** switching back to Pages restores the book spreads
- **Hard nos:** no fake or dead controls (a control the product cannot do yet is hidden or shown disabled with the kit look); no blue / teal; no layout shift or page-level H/V scroll; no master behavior beyond what the document model supports (real parent spreads are P2 `parent-spreads`)
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** Playwright e2e on the `?fixture=` editor/library view asserting the kit structure and tokens; screenshot side by side with the kit baseline for steps 21–23, signed off by Designer review
- **Depends:** kit10-spread-list, kit10-grid-snap
- **UI kit:** `uikit#/feature/parent-spreads` (`uikit/src/features/pages.tsx` page `parent-spreads`); parts: `uikit/src/demo-parts/editor.tsx` (`SpreadListPart, InspectorPart`)
