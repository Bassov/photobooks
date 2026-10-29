# derivative-tuning

Tag: feature
Milestone: P3
Title: decide final sizes

## Scope

- [ ] In-app comparison page for size/quality presets on hard fixtures (sky gradients, shadows, foliage)
- [ ] Record the chosen presets in config and spec
- **Browser check:** compare 2K vs 4K and quality levels side by side; pick defaults.
- **Kit components:** `uikit#/feature/in-app-publish` (`uikit/src/features/pages.tsx` page `in-app-publish`); parts: `uikit/src/demo-parts/dialogs.tsx` (`PublishDialog`)
- **Demo:** `uikit#/demo` steps 32 `publish-options` (walk in `uikit/scripts/demo-capture.mjs`)
- **Musts:** web image size 1600 / 2048 / 3200 px
- **Hard nos:** no fake or dead controls (a control the product cannot do yet is hidden or shown disabled with the kit look); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** image-derivatives, avif-encoder
- **UI kit:** `uikit#/feature/in-app-publish` (`uikit/src/features/pages.tsx` page `in-app-publish`); parts: `uikit/src/demo-parts/dialogs.tsx` (`PublishDialog`)
