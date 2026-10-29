# in-app-publish

Tag: feature
Milestone: P3
Title: publish button (Security Review)

## Scope

- [ ] Incremental upload by hash manifest from a worker; progress and retry
- **Perf:** scenario: edit with drag while an upload runs — zero LoAF.
- **Browser check:** change one spread, publish, only changed files upload, the live site updates; the editor stays smooth during upload.
- **Kit components:** `uikit#/feature/in-app-publish` (`uikit/src/features/pages.tsx` page `in-app-publish`); parts: `uikit/src/demo-parts/dialogs.tsx` (`PublishDialog`)
- **Demo:** `uikit#/demo` steps 32 `publish-options`, 33 `publish-running-50pct`, 34 `publish-done`, 35 `site-catalog` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** Publish → progress → Published → Open site
- **Hard nos:** no fake or dead controls (a control the product cannot do yet is hidden or shown disabled with the kit look); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** publish-credentials, static-export, publish-revisions
- **UI kit:** `uikit#/feature/in-app-publish` (`uikit/src/features/pages.tsx` page `in-app-publish`); parts: `uikit/src/demo-parts/dialogs.tsx` (`PublishDialog`)
