# kit10-inspector-book-endpaper

Tag: feature
Milestone: P1
Title: Inspector book settings and endpaper: kit v0.10 look
Status: done

## Scope

- [ ] Book settings and Endpaper inspector contexts as kit v0.10 (shipped Book settings + grid keep working, restyled).
- **Perf:** look-only change; no new subscriptions; scrolling and drag stay at 60 fps (Performance panel).
- **Browser check:** compare the product screen with the kit `#/demo` steps listed in Demo on the preview URL; no page-level H/V scroll.
- **Kit components:** `uikit#/feature/inspector` (`uikit/src/features/pages.tsx` page `inspector`); parts: `uikit/src/demo-parts/editor.tsx` (`InspectorPart`), `uikit/src/components/ui/numberfield.tsx` (`NumberField`)
- **Demo:** `uikit#/demo` steps 24 `editor-inspector-book`, 25 `editor-endpaper-selected` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** endpaper selection shows endpaper properties from `cover-endpaper-schema`
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll; do not remove shipped behavior
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** Playwright e2e on the `?fixture=` editor/library view asserting the kit structure and tokens; screenshot side by side with the kit baseline for steps 24, 25, signed off by Designer review
- **Depends:** kit10-inspector-frame-spread, cover-endpaper-schema
- **UI kit:** `uikit#/feature/inspector` (`uikit/src/features/pages.tsx` page `inspector`); parts: `uikit/src/demo-parts/editor.tsx` (`InspectorPart`), `uikit/src/components/ui/numberfield.tsx` (`NumberField`)

## Done note

Book settings restyled (kit head + eyebrow section). The Endpaper inspector context is not built: endpapers have no selection path yet (spread list and canvas hide them, D2); it lands with `kit10-cover`, which depends on this item.
