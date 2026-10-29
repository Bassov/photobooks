# derivative-tuning

Tag: prep
Milestone: P3
Title: decide final sizes

## Scope

- [ ] Dev-only comparison page (no product UI) for size/quality presets on hard fixtures (sky gradients, shadows, foliage)
- [ ] Record the chosen presets in config and spec
- **Browser check:** compare 2K vs 4K and quality levels side by side; pick defaults.
- **Done when:** presets recorded in config + spec
- **Kit components:** none (dev-only comparison page, no product UI); size select ships in `in-app-publish`
- **Demo:** n/a (prep)
- **Musts:** web image size 1600 / 2048 / 3200 px
- **Hard nos:** no fake, dead or disabled-stub controls (a control the product cannot do yet is hidden; D2); no blue / teal; no layout shift or page-level H/V scroll
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit on the preset config; no e2e (no product UI)
- **Depends:** image-derivatives, avif-encoder
- **UI kit:** `uikit#/feature/in-app-publish` (`uikit/src/features/pages.tsx` page `in-app-publish`); parts: `uikit/src/demo-parts/dialogs.tsx` (`PublishDialog`)
