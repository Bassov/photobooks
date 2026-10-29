# cover-editor

Tag: feature
Milestone: P4
Title: cover in the editor

## Scope

- [ ] Cover as a special spread: back / spine / front zones, hinge and wrap overlays, spine width from the profile and page count; spine text rotated 90°
- **Perf:** spine width change re-renders only the cover.
- **Browser check:** adding pages widens the spine on the cover; spine text stays centered.
- **Kit components:** `uikit#/feature/cover-editor` (`uikit/src/features/pages.tsx` page `cover-editor`); parts: `uikit/src/demo-parts/editor.tsx` (`CanvasPart, InspectorPart`)
- **Demo:** `uikit#/demo` steps 09 `editor-cover-selected`, 13 `editor-cover-photo-and-title` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** cover with the right spine for print
- **Hard nos:** no fake or dead controls (a control the product cannot do yet is hidden or shown disabled with the kit look); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** kit10-cover, print-model-schema
- **UI kit:** `uikit#/feature/cover-editor` (`uikit/src/features/pages.tsx` page `cover-editor`); parts: `uikit/src/demo-parts/editor.tsx` (`CanvasPart, InspectorPart`)
