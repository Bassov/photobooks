# dpi-badge

Tag: feature
Milestone: P2
Title: resolution while you lay out
Status: done

## Scope

- [ ] Badge on frames below the profile's warn / min DPI (book-editor defaults when no profile is chosen) on the editor overlay layer (editor-only, never in output)
- **Perf:** DPI computed inside the memoized resolve per spread; one badge element per low frame; recomputed only for changed spreads. Gate: crop-zoom pan across the threshold — zero LoAF.
- **Browser check:** zoom a low-DPI photo inside its frame — the badge appears at the book-editor default threshold (warn 200 / min 150 dpi until `print-profiles`) and clears when zoomed out; badges never appear in Preview or output.
- **Kit components:** frame badge `uikit/src/sandbox/canvas.tsx:109-131` (`effectiveDpi` `uikit/src/sandbox/model.ts:203`, shown under 300 dpi, `{n} dpi` chip) behind `view.dpi` (default off `uikit/src/sandbox/store.tsx:63`; `ViewToggle "dpi"` `uikit/src/sandbox/chrome.tsx:64`, no shortcut), **kit: sandbox, not shown in #/demo**; inspector Photo section dpi badge `uikit/src/sandbox/inspector.tsx:103-117` (demo step 16); filmstrip Low-res chip `uikit/src/sandbox/chrome.tsx:469` (demo steps 11–12)
- **Demo:** `uikit#/demo` steps 11–12 (Low-res chip), 16 `editor-frame-selected` (inspector dpi badge); the on-canvas frame badge has no step (exposed by P1 `kit10-demo-expose-hidden`)
- **Musts:** low-resolution warning on frames
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll; badges never in Preview or output
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** kit10-canvas
- **UI kit:** partial: frame badge `uikit/src/sandbox/canvas.tsx:109-131`, inspector badge `uikit/src/sandbox/inspector.tsx:103-117`, Low-res chip `uikit/src/sandbox/chrome.tsx:469`; missing: the frame badge is not reachable in #/demo
- **Owner-approved scope change:** 2026-10-30 02:01 (UTC+4) the Owner said to finish the roadmap with Designer and Grok Bot, then commit and merge without waiting for his formal approval; this item was updated from the Designer kit-first audit and the Grok Bot #/demo check (kit present in `uikit/src/sandbox`).

## Done note

frame badge on the editor overlay (session pixel size, warn 200 / min 150); inspector Photo-row dpi badge and filmstrip Low-res chip left to inspector/filmstrip items
