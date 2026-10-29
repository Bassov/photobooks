# site-viewer

Tag: feature
Milestone: P3
Title: viewer entry

## Scope

- [ ] Separate Vite entry: catalog, book page, spread navigation, `srcset`; captions via the same `SpreadView`
- [ ] Site theme: own palette on the same token scales (`docs/design.md`)
- **Perf:** `content-visibility` for off-screen spreads; Lighthouse budgets for the viewer entry.
- **Browser check:** open the viewer entry on a fixture library; catalog → book → spreads; photos are light on mobile.
- **Kit components:** `uikit#/feature/site-viewer` (`uikit/src/features/pages.tsx` page `site-viewer`); parts: `uikit/src/demo-parts/site.tsx` (`DemoSite, SiteCover`), `uikit/src/features/site-viewer.tsx` (`site viewer`)
- **Demo:** `uikit#/demo` steps 35 `site-catalog`, 36 `site-book`, 37 `site-share` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** catalog, book viewer, Share
- **Hard nos:** no fake or dead controls (a control the product cannot do yet is hidden or shown disabled with the kit look); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** image-derivatives
- **UI kit:** `uikit#/feature/site-viewer` (`uikit/src/features/pages.tsx` page `site-viewer`); parts: `uikit/src/demo-parts/site.tsx` (`DemoSite, SiteCover`), `uikit/src/features/site-viewer.tsx` (`site viewer`)
