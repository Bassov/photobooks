# site-preview-mode

Tag: feature
Milestone: P3
Title: preview the site from the editor

## Scope

- [ ] "Preview site" mode inside the app reading the current library
- **Perf:** preview mounts lazily; the editor store is not re-subscribed per spread.
- **Browser check:** preview the site from the editor, change a photo or the cover title, preview again — it updates.
- **Kit components:** `uikit#/feature/site-preview-mode` (`uikit/src/features/pages.tsx` page `site-preview-mode`)
- **Demo:** `uikit#/demo` steps 26 `editor-preview` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** preview current book without publishing; Esc returns
- **Hard nos:** no fake or dead controls (a control the product cannot do yet is hidden or shown disabled with the kit look); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** site-viewer, kit10-editor-chrome
- **UI kit:** `uikit#/feature/site-preview-mode` (`uikit/src/features/pages.tsx` page `site-preview-mode`)
