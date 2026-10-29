# static-export

Tag: feature
Milestone: P3
Title: write `dist/`

## Scope

- [ ] Prerender and file writes in a worker; progress (cancel: not in kit — not built until Designer adds it, D2)
- **Perf:** scenario: edit with drag while the export writes — zero LoAF.
- **Browser check:** export to a folder while continuing to edit without stutter, serve it locally, open on phone and desktop; drafts are absent.
- **Kit components:** `uikit#/feature/in-app-publish` (`uikit/src/features/pages.tsx` page `in-app-publish`); parts: `uikit/src/demo-parts/dialogs.tsx` (`PublishDialog`); partial: kit shows export only as part of Publish
- **Demo:** `uikit#/demo` steps 32 `publish-options`, 33 `publish-running-50pct`, 34 `publish-done` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** deterministic `dist/`
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** static-export-core
- **UI kit:** `uikit#/feature/in-app-publish` (`uikit/src/features/pages.tsx` page `in-app-publish`); parts: `uikit/src/demo-parts/dialogs.tsx` (`PublishDialog`); partial: kit shows export only as part of Publish
