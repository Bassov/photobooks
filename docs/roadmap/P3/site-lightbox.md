# site-lightbox

Tag: feature
Milestone: P3
Title: fullscreen and swipe

## Scope

- [ ] Fullscreen lightbox with CSS zoom; swipe between spreads
- [ ] Reuses the spread pager from `presentation-mode`
- **Perf:** swipe and lightbox zoom `transform`-only, neighbours preloaded and decoded; mobile scenario with CPU throttling — zero LoAF.
- **Browser check:** fullscreen photos are sharp on 4K, light on mobile; swiping is smooth on a phone.
- **Kit components:** `uikit#/feature/site-lightbox` (`uikit/src/features/pages.tsx` page `site-lightbox`); parts: `uikit/src/demo-parts/site.tsx` (`DemoSite`)
- **Demo:** `uikit#/demo` steps 38 `site-fullscreen` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** fullscreen; arrows step spreads; Esc closes
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** site-viewer
- **UI kit:** `uikit#/feature/site-lightbox` (`uikit/src/features/pages.tsx` page `site-lightbox`); parts: `uikit/src/demo-parts/site.tsx` (`DemoSite`)
