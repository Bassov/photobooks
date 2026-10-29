# printer-presets

Tag: feature
Milestone: P5
Title: print for everyone

## Scope

- [ ] Catalog of common print-shop profiles plus a custom profile editor
- **Browser check:** pick a preset, export a PDF that matches its spec.
- **Perf:** switching presets re-runs preflight in a worker; zero LoAF.
- **Kit components:** `uikit#/feature/site-settings` scenario `print` (`uikit/src/demo-parts/settings.tsx` `SettingsScreen`); partial: custom profile editor not in kit (Designer, D6)
- **Demo:** `#/feature/site-settings` scenario `print` (not in `#/demo`)
- **Musts:** print presets for everyone
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** print-profiles, kit10-settings
- **UI kit:** `uikit#/feature/site-settings` (`uikit/src/features/pages.tsx` page `site-settings`); parts: `uikit/src/demo-parts/settings.tsx` (`SettingsScreen (Print presets)`)
