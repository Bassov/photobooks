# parent-guides

Tag: feature
Milestone: P2
Title: guides on parent spreads

## Scope

- [ ] Guides created, moved or typed in while editing a parent belong to the parent; they appear on every spread using it (styled as inherited, not draggable there) and feed `snapping-engine`
- [ ] Spread guides are added on top of parent guides; show / hide guides and snap on / off cover both
- **Perf:** a parent guide drag is a `transform` in rAF on the parent view, committed at gesture end; only spreads using that parent re-render. Gate: drag a guide on a parent used by 40 spreads — zero LoAF.
- **Browser check:** add two guides on a parent — they appear on every spread using it and frames snap to them; add a spread-only guide — it shows on that spread alone.
- **Kit components:** `uikit/src/sandbox/model.ts:181` `allGuides` merges parent guides (`inherited`); built-in Master A/B guides `uikit/src/sandbox/model.ts:72-87`; `uikit/src/sandbox/viewport.tsx:190` edits `parents[].guides` when `features.parentEdit`; `uikit/src/sandbox/viewport.tsx:200-204` `onGuideDown` blocks inherited guides ("edit it on the parent, or Alt+click to override"); **kit: sandbox, not shown in #/demo** (`parentEdit` is not in `DEMO_FEATURES`, `uikit/src/demo-parts/editor.tsx:22`)
- **Demo:** `uikit#/demo` steps 14–20 show inherited master guides read-only; editing on the master has no step (exposed by P1 `kit10-demo-expose-hidden`)
- **Musts:** guides on masters
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** guides, parent-spreads
- **UI kit:** partial: `uikit/src/sandbox/model.ts` `allGuides`, `uikit/src/sandbox/viewport.tsx` parent guide edit; missing: master-side guide UI in #/demo
- **Owner-approved scope change:** 2026-10-30 02:01 (UTC+4) the Owner said to finish the roadmap with Designer and Grok Bot, then commit and merge without waiting for his formal approval; this item was updated from the Designer kit-first audit and the Grok Bot #/demo check (kit present in `uikit/src/sandbox`).
