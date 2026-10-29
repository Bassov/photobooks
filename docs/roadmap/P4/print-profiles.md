# print-profiles

Tag: prep
Milestone: P4
Title: printer data

## Scope

- [ ] Profile schema: trim, page and cover bleed, safe margin, page count `{min, step, max}`, single first page, printed endpapers, spine (formula or table, manual override), `output: pages | spreads` (jpeg-spreads held in `docs/backlog/`), crop marks (default off), color space (sRGB), file limits, warn / min DPI, min font size
- [ ] Pure effective-DPI function in `src/core` (from the asset record's oriented pixels, frame size and crop zoom)
- **Kit components:** none (prep, no UI)
- **Demo:** n/a (prep)
- **Done when:** profile schema parses / round-trips with PBT; effective DPI matches hand-computed fixtures (oriented pixels, frame size, crop zoom)
- **Musts:** see Scope
- **Hard nos:** no UI
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit + PBT on the pure module; no e2e (no UI); perf scenario only where Scope names one
- **Depends:** print-model-schema
