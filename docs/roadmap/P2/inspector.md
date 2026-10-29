# inspector

Tag: feature
Milestone: P2
Title: numeric properties

## Scope

- [ ] Delta only (numeric X / Y / W / H + rotation already ship in `FrameSections.tsx` `GeometrySection`): inspector values stay in sync during a drag (from the transient gesture state, throttled to rAF)
- **Perf:** inspector subscribes to the selection only; live values during a drag come from the transient gesture state, throttled to rAF.
- **Browser check:** typing values moves frames precisely; values stay in sync with dragging.
- See also: inspector-frame-sections, inspector-spread-book (visual subsets)
- **Kit components:** `uikit#/feature/inspector` (`uikit/src/features/pages.tsx` page `inspector`); parts: `uikit/src/demo-parts/editor.tsx` (`InspectorPart`), `uikit/src/components/ui/numberfield.tsx` (`NumberField`)
- **Demo:** `uikit#/demo` steps 16 `editor-frame-selected`, 20 `editor-spread-selected`, 24 `editor-inspector-book`, 25 `editor-endpaper-selected` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** values stay in sync with drag without re-rendering the canvas
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** kit10-inspector-frame-spread
- **UI kit:** `uikit#/feature/inspector` (`uikit/src/features/pages.tsx` page `inspector`); parts: `uikit/src/demo-parts/editor.tsx` (`InspectorPart`), `uikit/src/components/ui/numberfield.tsx` (`NumberField`)
