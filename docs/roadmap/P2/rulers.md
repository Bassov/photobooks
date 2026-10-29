# rulers

Tag: feature
Milestone: P2
Title: mm rulers

## Scope

- [ ] Restyle the shipped mm rulers (`src/editor/Rulers.tsx`, done in M4 `look-parity-rulers`) to the kit sandbox `Ruler`; rulers default **off** (**Owner-confirm**, Designer call M5/D1)
- **Perf:** rulers drawn on a `<canvas>` per camera frame. Gate: pan / zoom with rulers visible — zero LoAF.
- **Browser check:** pan and zoom; ruler ticks stay aligned with the spread.
- **Kit components:** `uikit/src/sandbox/viewport.tsx:84` `Ruler` (mm, cursor tick, `data-testid=ruler-x/y`; `RULER=22` :83; shown when `view.rulers` :120); Shift+R `uikit/src/sandbox/viewport.tsx:65`; `ViewToggle k="rulers"` `uikit/src/sandbox/chrome.tsx:64,87`; **kit: sandbox, not shown in #/demo** (Shift+R only; demo `TopBar` `views` = snap, grid, `uikit/src/sandbox/chrome.tsx:143`)
- **Demo:** none yet: any editor step 08–25 after Shift+R; no capture step (exposed by P1 `kit10-demo-expose-hidden`)
- **Musts:** mm rulers follow the camera
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll; rulers default **off** (**Owner-confirm**)
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** kit10-canvas
- **UI kit:** partial: `uikit/src/sandbox/viewport.tsx` `Ruler`, `uikit/src/sandbox/chrome.tsx` `ViewToggle`; missing: #/demo toolbar toggle and capture step
- **Owner-approved scope change:** 2026-10-30 02:01 (UTC+4) the Owner said to finish the roadmap with Designer and Grok Bot, then commit and merge without waiting for his formal approval; this item was updated from the Designer kit-first audit and the Grok Bot #/demo check (kit present in `uikit/src/sandbox`).
