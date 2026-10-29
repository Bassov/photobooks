# kit10-inspector

Tag: feature
Milestone: P1
Title: Inspector frame / spread / book / endpaper: kit v0.10 look

## Scope

- [ ] Right inspector (300 px) following the selection: Frame, Spread, Book settings, Endpaper sections as kit v0.10.
- **Perf:** look-only change; no new subscriptions; scrolling and drag stay at 60 fps (Performance panel).
- **Browser check:** compare the product screen with the kit `#/demo` steps listed in Demo on the preview URL; no page-level H/V scroll.
- **Kit components:** `uikit#/feature/inspector` (`uikit/src/features/pages.tsx` page `inspector`); parts: `uikit/src/demo-parts/editor.tsx` (`InspectorPart`), `uikit/src/components/ui/numberfield.tsx` (`NumberField`)
- **Demo:** `uikit#/demo` steps 16 `editor-frame-selected`, 20 `editor-spread-selected`, 24 `editor-inspector-book`, 25 `editor-endpaper-selected` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** nothing selected shows spread properties; sections exist only for wired behavior, others disabled stubs
- **Hard nos:** no fake or dead controls (a control the product cannot do yet is hidden or shown disabled with the kit look); no blue / teal; no layout shift or page-level H/V scroll; no caption / frame-style / template / arrange-lock controls before their P2 items
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** Playwright e2e on the `?fixture=` editor/library view asserting the kit structure and tokens; screenshot side by side with the kit baseline for steps 16, 20, 24, 25, signed off by Designer review
- **Depends:** ui-primitives-forms, kit10-frame-selection
- **UI kit:** `uikit#/feature/inspector` (`uikit/src/features/pages.tsx` page `inspector`); parts: `uikit/src/demo-parts/editor.tsx` (`InspectorPart`), `uikit/src/components/ui/numberfield.tsx` (`NumberField`)
