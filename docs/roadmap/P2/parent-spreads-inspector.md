# parent-spreads-inspector

Tag: feature
Milestone: P2
Title: parent spreads: master inspector (grid, guides, items)

## Scope

- [ ] Master inspector in Masters mode: with a master selected the inspector shows its name and layout grid (columns, rows, margins, gutter; the canvas redraws the grid), and the frame sections for a selected master item
- Owner-approved scope change: guides on the master canvas (Designer Spec MS10) moved to `parent-spreads-inspector-guides` (Owner brief 2026-11-03).
- **Browser check:** select Master A, set its grid to 5 columns — the master canvas and every spread using it show 5 columns.
- **Kit components:** `uikit#/feature/parent-spreads`, `uikit#/feature/layout-grids-settings` (grid "Master grid"); parts: `uikit/src/demo-parts/editor.tsx` (`InspectorPart`)
- **Demo:** `uikit#/demo` step 22 `editor-master-grid-5-cols`
- **Hard nos:** no fake, dead or disabled-stub controls (D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md); values from `uikit/src/index.css`, mapped to `src/ui/` tokens.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor
- **Depends:** parent-spreads-edit
