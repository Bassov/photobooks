# multi-select

Tag: feature
Milestone: P2
Title: group operations

## Scope

- [ ] Shift / marquee selection, group move, align and distribute
- **Perf:** marquee hit-test via the spatial index; group move is one `transform` per selected frame in rAF.
- **Browser check:** select three frames and distribute them evenly; marquee over a full spread stays smooth.
- **Kit components:** `uikit#/feature/frame-selection-handles` (`uikit/src/features/pages.tsx` page `frame-selection-handles`); parts: `uikit/src/demo-parts/editor.tsx` (`CanvasPart`); `AlignSection` (`uikit/src/sandbox/inspector.tsx`); page scenario with two frames selected
- **Demo:** `uikit#/demo` steps 16 `editor-frame-selected` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** shift-click multi-select; group move
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** kit10-frame-selection, arrange-lock
- **UI kit:** `uikit#/feature/frame-selection-handles` (`uikit/src/features/pages.tsx` page `frame-selection-handles`); parts: `uikit/src/demo-parts/editor.tsx` (`CanvasPart`); `AlignSection` (`uikit/src/sandbox/inspector.tsx`); page scenario with two frames selected
