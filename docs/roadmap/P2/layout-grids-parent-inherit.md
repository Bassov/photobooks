# layout-grids-parent-inherit

Tag: feature
Milestone: P2
Title: grids on parent spreads

## Scope

- [ ] Grid section while editing a parent: margins, columns, rows, gutters set on the parent; spreads using it inherit them
- [ ] Spread overrides from `layout-grids-settings` now apply on top of the parent; the grid section shows each value's source (book / parent / spread) with "Reset to parent"
- [ ] Assigning a parent or editing its grid re-aligns template-driven spreads using it (placements kept, one history step)
- **Perf:** a parent grid edit re-resolves only spreads using that parent. Gate: edit the grid of a parent used by 40 spreads — zero LoAF.
- **Browser check:** give a parent a 3-column grid and apply it to five spreads — their overlays and template frames follow; override one spread's gutter; switch the parent to 4 columns — the inheriting spreads update and the override keeps its gutter.
- **Kit components:** `uikit#/feature/parent-spreads` (`uikit/src/features/pages.tsx` page `parent-spreads`), `uikit#/feature/layout-grids-settings` (`uikit/src/features/pages.tsx` page `layout-grids-settings`)
- **Demo:** `uikit#/demo` steps 20 `editor-spread-selected`, 22 `editor-master-grid-5-cols` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** spreads inherit the master grid; the per-spread grid override follows the kit "Use master" / Custom `SpreadGridSection` (`uikit/src/sandbox/context-inspector.tsx:214-227`, `uikit/src/sandbox/sections.tsx:22-34`; #/demo step 20 `editor-spread-selected`)
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** parent-spreads, layout-grids-schema
- **UI kit:** `uikit#/feature/parent-spreads` (`uikit/src/features/pages.tsx` page `parent-spreads`), `uikit#/feature/layout-grids-settings` (`uikit/src/features/pages.tsx` page `layout-grids-settings`)
- **Owner-approved scope change:** 2026-10-30 02:01 (UTC+4) the Owner said to finish the roadmap with Designer and Grok Bot, then commit and merge without waiting for his formal approval; this item was updated from the Designer kit-first audit and the Grok Bot #/demo check (kit present in `uikit/src/sandbox`).
