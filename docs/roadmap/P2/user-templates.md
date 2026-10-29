# user-templates

Tag: feature
Milestone: P2
Title: your own layouts

## Scope

- [ ] Save a spread as a template (frames normalized to trim, slot aspects); templates stored in `library.json`, which gets its own `schemaVersion` and migration chain here (the first item to change `library.json`); apply from the template bar; `multi-drop-fill` best fit can pick them
- **Browser check:** save a custom spread as a template, apply it to another spread; it survives a reload.
- **Kit components:** `uikit#/feature/inspector` (`uikit/src/features/pages.tsx` page `inspector`); partial: "Save as template" exists in sandbox only; Designer confirms
- **Demo:** `uikit#/demo` steps 20 `editor-spread-selected` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** save a spread layout as a template
- **Hard nos:** no fake or dead controls (a control the product cannot do yet is hidden or shown disabled with the kit look); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** kit10-inspector
- **UI kit:** `uikit#/feature/inspector` (`uikit/src/features/pages.tsx` page `inspector`); partial: "Save as template" exists in sandbox only; Designer confirms
