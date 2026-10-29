# kit10-place-replace

Tag: feature
Milestone: P1
Title: Drag place and replace: kit v0.10 look

## Scope

- [ ] Drop-target and placed-photo visuals for drag from filmstrip onto frames and the cover, as kit v0.10.
- **Perf:** look-only change; no new subscriptions; scrolling and drag stay at 60 fps (Performance panel).
- **Browser check:** compare the product screen with the kit `#/demo` steps listed in Demo on the preview URL; no page-level H/V scroll.
- **Kit components:** `uikit#/feature/drag-place-replace` (`uikit/src/features/pages.tsx` page `drag-place-replace`); parts: `uikit/src/demo-parts/editor.tsx` (`CanvasPart, FilmstripPart`)
- **Demo:** `uikit#/demo` steps 13 `editor-cover-photo-and-title`, 15 `editor-photo-dropped-in-frame` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** drop target highlight in grayscale; placed photo marked in the filmstrip
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** Playwright e2e on the `?fixture=` editor/library view asserting the kit structure and tokens; screenshot side by side with the kit baseline for steps 13, 15, signed off by Designer review
- **Depends:** kit10-canvas, kit10-filmstrip, cover-endpaper-schema
- **UI kit:** `uikit#/feature/drag-place-replace` (`uikit/src/features/pages.tsx` page `drag-place-replace`); parts: `uikit/src/demo-parts/editor.tsx` (`CanvasPart, FilmstripPart`)
