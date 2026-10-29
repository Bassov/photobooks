# kit10-cover

Tag: feature
Milestone: P1
Title: Cover on canvas and in the inspector: kit v0.10 look

## Scope

- [ ] Cover as back · spine · front with title text, drop a photo on the front, as kit v0.10.
- **Perf:** look-only change; no new subscriptions; scrolling and drag stay at 60 fps (Performance panel).
- **Browser check:** compare the product screen with the kit `#/demo` steps listed in Demo on the preview URL; no page-level H/V scroll.
- **Kit components:** `uikit#/feature/cover-editor` (`uikit/src/features/pages.tsx` page `cover-editor`); parts: `uikit/src/demo-parts/editor.tsx` (`CanvasPart, InspectorPart`)
- **Demo:** `uikit#/demo` steps 09 `editor-cover-selected`, 13 `editor-cover-photo-and-title` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** new book cover text is its title
- **Hard nos:** no fake or dead controls (a control the product cannot do yet is hidden or shown disabled with the kit look); no blue / teal; no layout shift or page-level H/V scroll; no spine width / print behavior (P4 `cover-editor`)
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** Playwright e2e on the `?fixture=` editor/library view asserting the kit structure and tokens; screenshot side by side with the kit baseline for steps 09, 13, signed off by Designer review
- **Depends:** kit10-canvas, kit10-inspector
- **UI kit:** `uikit#/feature/cover-editor` (`uikit/src/features/pages.tsx` page `cover-editor`); parts: `uikit/src/demo-parts/editor.tsx` (`CanvasPart, InspectorPart`)
