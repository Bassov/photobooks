# parent-overrides

Tag: feature
Milestone: P2
Title: change one spread without touching the parent

## Scope

- [ ] On a spread: override a parent item or guide (Ctrl/Cmd+Shift+click on the inherited item, as in InDesign, or the context-menu "Override parent item" creates a local copy that stops following the parent on that spread), hide a parent item or guide on this spread, "Reset to parent" per item and for the whole spread
- [ ] Overridden and hidden parent items marked in the inspector; the spread's own frames and guides add on top as usual
- **Perf:** an override or reset re-renders only its spread; parent edits skip overridden copies. Gate: edit a parent used by 40 spreads where 10 override its logo — zero LoAF.
- **Browser check:** override the parent logo on one spread and move it, hide a parent guide on another, then move the logo on the parent — every other spread follows, the overridden one keeps its position, the hidden guide stays hidden; Reset to parent restores both.
- **Kit components:** `uikit/src/sandbox/model.ts:43` `Frame.overrides`; `uikit/src/sandbox/canvas.tsx:250` overridden set; `uikit/src/sandbox/canvas.tsx:403-407` Alt / Ctrl+Shift+click makes a local copy; `uikit/src/sandbox/canvas.tsx:121` override badge; `uikit/src/sandbox/store.tsx:26` `features.overrides`; **kit: sandbox, not shown in #/demo** (`overrides` not in `DEMO_FEATURES`); no "Reset to parent" UI in the kit. The per-spread grid override ("Use master" / Custom, `uikit/src/sandbox/context-inspector.tsx:214-227`, step 20) belongs to `layout-grids-parent-inherit`
- **Demo:** none for frame overrides (exposed by P1 `kit10-demo-expose-hidden`)
- **Musts:** override one spread
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** parent-spreads
- **UI kit:** partial: `uikit/src/sandbox/canvas.tsx` override copy + badge; missing: #/demo reachability and Reset to parent
- **Owner-approved scope change:** 2026-10-30 02:01 (UTC+4) the Owner said to finish the roadmap with Designer and Grok Bot, then commit and merge without waiting for his formal approval; this item was updated from the Designer kit-first audit and the Grok Bot #/demo check (kit present in `uikit/src/sandbox`).
