# print-profiles

Tag: prep
Milestone: M6
Title: printer data and preflight

## Scope

- [ ] Profile schema: trim, page and cover bleed, safe margin, page count `{min, step, max}`, single first page, printed endpapers, spine (formula or table, manual override), `output: pages | spreads | jpeg-spreads`, crop marks (default off), color space (sRGB), file limits, warn / min DPI, min font size
- [ ] Pure effective-DPI function in `src/core` (from the asset record's oriented pixels, frame size and crop zoom)
- [ ] Pure preflight with severities (error / warning / info) and fix-action ids: effective DPI, safe-zone intrusion, bleed hazard, empty frames, missing / modified assets, page-count rules
