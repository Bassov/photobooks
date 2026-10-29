# kit10-masters

Tag: feature
Milestone: P1
Title: Masters mode: kit v0.10 look

## Scope

- [ ] Restyle the existing Pages / Masters switch and the 'No masters yet' empty state (`src/editor/LeftPanel.tsx`) to kit v0.10; no master A / B entries until P2 `parent-spreads`.
- **Perf:** look-only change; no new subscriptions; scrolling and drag stay at 60 fps (Performance panel).
- **Browser check:** compare the product screen with the kit `#/demo` steps listed in Demo on the preview URL; no page-level H/V scroll.
- **Kit components:** `uikit#/feature/parent-spreads` (`uikit/src/features/pages.tsx` page `parent-spreads`); parts: `uikit/src/demo-parts/editor.tsx` (`SpreadListPart, InspectorPart`)
- **Demo:** `uikit#/demo` steps 21 `editor-masters-mode`, 23 `editor-pages-mode` (switch only; step 22 belongs to P2 `parent-spreads` / `layout-grids-parent-inherit`) (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** switching back to Pages restores the book spreads
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll; no master behavior beyond what the document model supports (real parent spreads are P2 `parent-spreads`)
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** Playwright e2e on the `?fixture=` editor/library view asserting the kit structure and tokens; screenshot side by side with the kit baseline for steps 21, 23 (switch only), signed off by Designer review
- **Depends:** kit10-spread-list
- **UI kit:** `uikit#/feature/parent-spreads` (`uikit/src/features/pages.tsx` page `parent-spreads`); parts: `uikit/src/demo-parts/editor.tsx` (`SpreadListPart, InspectorPart`)
