# kit10-demo-expose-hidden

Tag: feature
Milestone: P1
Title: Kit #/demo: expose hidden sandbox features (views, spread menu, parent edit, missing photo, relink)
Status: done

## Scope

- [ ] Kit item (Designer, in `uikit/`): expose the sandbox features #/demo hides, and add capture steps: TopBar `views` with guides / rulers / dpi (`uikit/src/sandbox/chrome.tsx:64,143`); `<SpreadsPanel reorder actions />` (`uikit/src/features/parts.tsx:32`, `uikit/src/sandbox/chrome.tsx:267,337,365`); `parentEdit` / `overrides` in Masters (`DEMO_FEATURES` `uikit/src/demo-parts/editor.tsx:22`); a missing-photo step (seed `missing`, `uikit/src/sandbox/store.tsx:49,91`); a Relink dialog part (none in the kit yet; port the product `src/editor/relink/RelinkDialog.tsx`); wire the v7 master Page numbers toggle to `Parent.pageNumbers`.
- **Perf:** kit-only change; no product code.
- **Browser check:** open `uikit#/demo`; the new steps show rulers, guides, the frame dpi badge, the spread row menu / reorder, master guide editing and overrides, a missing photo and the relink dialog.
- **Owner go 2026-10-30 02:14** (unblocked). Actionable now.
- **Kit components:** `uikit/src/sandbox/chrome.tsx` (`TopBar`, `SpreadsPanel`, `SpreadItemMenu`, `ViewToggle`), `uikit/src/sandbox/viewport.tsx` (`Ruler`, guide drag), `uikit/src/sandbox/canvas.tsx` (dpi badge, overrides, missing hatch), `uikit/src/demo-parts/editor.tsx` (`DemoEditor`, `DEMO_FEATURES`)
- **Demo:** new capture steps in `uikit/scripts/demo-capture.mjs`
- **Musts:** every item marked "kit: sandbox, not shown in #/demo" becomes reachable from a visible control in #/demo
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** kit demo capture baseline updated with the new steps, signed off by Designer review
- **Depends:** none
- **UI kit:** `uikit/src/demo-parts/editor.tsx` (`DemoEditor`), `uikit/src/sandbox/chrome.tsx` (`TopBar`, `SpreadsPanel`)
- **Owner-approved scope change:** 2026-10-30 02:01 (UTC+4) the Owner said to finish the roadmap with Designer and Grok Bot, then commit and merge without waiting for his formal approval; this item was updated from the Designer kit-first audit and the Grok Bot #/demo check (kit present in `uikit/src/sandbox`).
