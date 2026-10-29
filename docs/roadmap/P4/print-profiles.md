# print-profiles

Tag: prep
Milestone: P4
Title: printer data and preflight

## Scope

- [ ] Profile schema: trim, page and cover bleed, safe margin, page count `{min, step, max}`, single first page, printed endpapers, spine (formula or table, manual override), `output: pages | spreads | jpeg-spreads`, crop marks (default off), color space (sRGB), file limits, warn / min DPI, min font size
- [ ] Pure effective-DPI function in `src/core` (from the asset record's oriented pixels, frame size and crop zoom)
- [ ] Pure preflight with severities (error / warning / info) and fix-action ids: effective DPI, safe-zone intrusion, bleed hazard, empty frames, missing / modified assets, page-count rules
- **Kit components:** none (prep, no UI)
- **Demo:** n/a (prep)
- **Musts:** see Scope
- **Hard nos:** no UI
- **Tokens:** Grayscale product tokens (RULES.md): field `#D7D7D7`, bar `#E1E1E1`, list / film selection `#CACACA`, canvas selection `#232223` with white handles, crop `--crop` `#6b696a`; values from `uikit/src/index.css`, mapped to `src/ui/` tokens. No blue, no teal.
- **Test:** unit / PBT for the pure logic; Playwright e2e for the interaction on the `?fixture=` editor; perf scenario per RULES
- **Depends:** print-model-schema
