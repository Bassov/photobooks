# kit10-settings

Tag: feature
Milestone: P1
Title: Settings screen: kit v0.10 look

## Scope

- [ ] Settings with back bar (Back to the book / Library) and sections Library, Hosting, Site, Print presets, Interface as kit v0.10.
- **Perf:** look-only change; no new subscriptions; scrolling and drag stay at 60 fps (Performance panel).
- **Browser check:** compare the product screen with the kit `#/demo` steps listed in Demo on the preview URL; no page-level H/V scroll.
- **Kit components:** `uikit#/feature/site-settings` (`uikit/src/features/pages.tsx` page `site-settings`); parts: `uikit/src/demo-parts/settings.tsx` (`SettingsScreen, DemoSettings`)
- **Demo:** `uikit#/demo` steps 40 `settings-from-editor`, 49 `settings-from-library` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** tone-only nav; Change library folder confirms first
- **Hard nos:** no fake or dead controls (a control the product cannot do yet is hidden or shown disabled with the kit look); no blue / teal; no layout shift or page-level H/V scroll; Hosting / Site / Print presets sections without backing behavior are hidden or disabled stubs (P3 / P4)
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** Playwright e2e on the `?fixture=` editor/library view asserting the kit structure and tokens; screenshot side by side with the kit baseline for steps 40, 49, signed off by Designer review
- **Depends:** kit10-library
- **UI kit:** `uikit#/feature/site-settings` (`uikit/src/features/pages.tsx` page `site-settings`); parts: `uikit/src/demo-parts/settings.tsx` (`SettingsScreen, DemoSettings`)
