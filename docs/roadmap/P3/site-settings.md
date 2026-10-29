# site-settings

Tag: feature
Milestone: P3
Title: personalize the showcase

## Scope

- [ ] Site title, author, about page, theme choice
- **Browser check:** change the title and theme; the preview and the published site update.
- **Kit components:** `uikit#/feature/site-settings` (`uikit/src/features/pages.tsx` page `site-settings`); parts: `uikit/src/demo-parts/settings.tsx` (`SettingsScreen (Site, Hosting)`)
- **Demo:** `uikit#/demo` steps 40 `settings-from-editor`, 49 `settings-from-library` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** site title / author; hosting part of Settings
- **Hard nos:** no fake or dead controls (a control the product cannot do yet is hidden or shown disabled with the kit look); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** kit10-settings, in-app-publish
- **UI kit:** `uikit#/feature/site-settings` (`uikit/src/features/pages.tsx` page `site-settings`); parts: `uikit/src/demo-parts/settings.tsx` (`SettingsScreen (Site, Hosting)`)
