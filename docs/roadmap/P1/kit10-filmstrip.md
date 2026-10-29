# kit10-filmstrip

Tag: feature
Milestone: P1
Title: Photos dock and filmstrip: kit v0.10 look (Photos only)

## Scope

- [ ] Photos dock: Add folder, filmstrip tiles, hover and used-photo marks as kit v0.10. Photos tab only.
- **Perf:** look-only change; no new subscriptions; scrolling and drag stay at 60 fps (Performance panel).
- **Browser check:** compare the product screen with the kit `#/demo` steps listed in Demo on the preview URL; no page-level H/V scroll.
- **Kit components:** `uikit#/feature/editor-shell-filmstrip` (`uikit/src/features/pages.tsx` page `editor-shell-filmstrip`); parts: `uikit/src/demo-parts/editor.tsx` (`PhotosDock, AddFolder, FilmstripPart`)
- **Demo:** `uikit#/demo` steps 10 `editor-add-folder-picker`, 11 `editor-photos-added`, 12 `editor-filmstrip-hover` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** Photos only; keep the shipped sort / filter working, restyled (**Owner-confirm**; Designer adds a kit page, call D1); used-photo badge black; file name on hover as kit
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll; **remove** the thumbnail size slider and the Assets tab (Owner rejected both explicitly; Designer call M5)
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** Playwright e2e on the `?fixture=` editor/library view asserting the kit structure and tokens; screenshot side by side with the kit baseline for steps 10–12, signed off by Designer review
- **Depends:** kit10-editor-chrome
- **UI kit:** `uikit#/feature/editor-shell-filmstrip` (`uikit/src/features/pages.tsx` page `editor-shell-filmstrip`); parts: `uikit/src/demo-parts/editor.tsx` (`PhotosDock, AddFolder, FilmstripPart`)
