# page-numbers

Tag: feature
Milestone: P2
Title: page numbers

## Scope

- [ ] Page-number item on parents (from `parent-spreads-schema`), derived from the spread's pages (left / right, start number, skip first, format)
- **Browser check:** page numbers appear on every page, follow reordering, and skip the first page.
- **Kit components:** `uikit/src/sandbox/model.ts:49` `Parent.pageNumbers`, Folio frames on built-in Master A `uikit/src/sandbox/model.ts:72-87`; render `uikit/src/sandbox/canvas.tsx:392-430` when `view.pageNumbers || parent.pageNumbers`; master inspector "Page numbers" Show toggle + Outer / Centre / Inner `uikit/src/demo-parts/v7.tsx:219` (`master-pn` preview `v7.tsx:110`); partial: in #/demo the toggle (v7 `Master.pn`) does not drive `Parent.pageNumbers`, so numbers do not render on book spreads; no start-number / format control
- **Demo:** `uikit#/demo` steps 21 `editor-masters-mode`, 22 `editor-master-grid-5-cols` (toggle); not rendered on spreads in the demo
- **Musts:** page numbers on spreads
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** text-frame-model, parent-spreads
- **UI kit:** partial: `uikit/src/demo-parts/v7.tsx` `BookInspector` Page numbers toggle, `uikit/src/sandbox/canvas.tsx` folio render; missing: demo wiring to spreads, start number / format
- **Owner-approved scope change:** 2026-10-30 02:01 (UTC+4) the Owner said to finish the roadmap with Designer and Grok Bot, then commit and merge without waiting for his formal approval; this item was updated from the Designer kit-first audit and the Grok Bot #/demo check (kit present in `uikit/src/sandbox`).
