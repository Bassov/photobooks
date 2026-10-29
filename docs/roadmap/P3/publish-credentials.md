# publish-credentials

Tag: feature
Milestone: P3
Title: connect the editor to your hosting (Security Review)

## Scope

- [ ] Locally stored, narrowly scoped credentials, entered from the existing export menu (no new panel); strict CSP
- **Browser check:** enter credentials once; they survive a reload and are never sent anywhere except the hosting API.
- **Kit components:** `uikit#/feature/site-settings` (`uikit/src/features/pages.tsx` page `site-settings`); parts: `uikit/src/demo-parts/settings.tsx` (`SettingsScreen (Hosting)`)
- **Demo:** `uikit#/demo` steps 40 `settings-from-editor` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** hosting credentials in Settings → Hosting
- **Hard nos:** no fake or dead controls (a control the product cannot do yet is hidden or shown disabled with the kit look); no blue / teal; no layout shift or page-level H/V scroll; no secrets in the document or logs
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** hosting-decision, kit10-settings
- **UI kit:** `uikit#/feature/site-settings` (`uikit/src/features/pages.tsx` page `site-settings`); parts: `uikit/src/demo-parts/settings.tsx` (`SettingsScreen (Hosting)`)
