# parent-spreads

Tag: feature
Milestone: P2
Title: parent spreads

## Scope

- [ ] Edit parent spreads (shared items), apply a parent to spreads, "None"; parent items render beneath spread items and are not selectable on the spread
- **Perf:** a parent edit re-renders only spreads using it. Gate: edit a parent used by 40 spreads — zero LoAF.
- **Browser check:** add a logo to a parent, apply it to every spread, move the logo once — all spreads update.
- **Kit components:** `uikit#/feature/parent-spreads` (`uikit/src/features/pages.tsx` page `parent-spreads`); parts: `uikit/src/demo-parts/editor.tsx` (`SpreadListPart, InspectorPart`)
- **Demo:** `uikit#/demo` steps 21 `editor-masters-mode`, 22 `editor-master-grid-5-cols`, 23 `editor-pages-mode` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** real master spreads behind the P1 Masters look
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** parent-spreads-schema, kit10-masters
- **UI kit:** `uikit#/feature/parent-spreads` (`uikit/src/features/pages.tsx` page `parent-spreads`); parts: `uikit/src/demo-parts/editor.tsx` (`SpreadListPart, InspectorPart`)
