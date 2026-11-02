# parent-spreads

Tag: feature
Milestone: P2
Title: parent spreads
Status: done

## Scope

- [ ] Apply a parent to the selected spread in the spread inspector, or "None"; parent items render beneath spread items (canvas, spread list, presentation) and are not selectable or draggable on the spread
- **Split (Owner brief 2026-11-02):** editing parents in Masters mode → `parent-spreads-edit`; the 40-spread edit perf gate → `parent-spreads-perf`.
- **Browser check:** apply a parent with one item to 2 spreads → the item shows on both and clicking it selects nothing; switch one to "None" → gone there only.
- **Kit components:** `uikit#/feature/parent-spreads` (`uikit/src/features/pages.tsx` page `parent-spreads`); parts: `uikit/src/demo-parts/editor.tsx` (`SpreadListPart, InspectorPart`)
- **Demo:** `uikit#/demo` steps 21 `editor-masters-mode`, 22 `editor-master-grid-5-cols`, 23 `editor-pages-mode` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** real master spreads behind the P1 Masters look
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor
- **Depends:** parent-spreads-schema, kit10-masters
- **UI kit:** `uikit#/feature/parent-spreads` (`uikit/src/features/pages.tsx` page `parent-spreads`); parts: `uikit/src/demo-parts/editor.tsx` (`SpreadListPart, InspectorPart`)
