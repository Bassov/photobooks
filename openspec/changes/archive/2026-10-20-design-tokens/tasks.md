## Implementation

- [x] 1. Add `src/ui/tokens.css` + self-hosted fonts; remove Google Fonts
- [x] 2. Migrate chrome CSS to design tokens
- [x] 3. Add `scripts/check-css-tokens.mjs` to gates
- [x] 4. Dev/test `?specimen` page + preferred theme
- [x] 5. Update `docs/design.md` migration audit; tick roadmap; `.skip-specs`
- [x] 6. verify / e2e / ui-review / Manual

## Manual test scenarios

1. OK Open `/` (empty home): Theme B chrome + Inter/Lora; no Google Fonts; no page-level scroll.
2. OK Open `/?fixture=painter`: tokens on chrome; pasteboard vertical scrollport; document fits.
3. OK `data-theme=b-dark`: chrome/canvas dark; `.spread-view` stays light (`--paper`).
4. OK Open `/?specimen`: swatches + type + spacing; specimen scrollport; local fonts.
5. OK `prefers-reduced-motion: reduce`: motion tokens zeroed.

### ui-review

- Design system / a11y / layout smoke / anti-slop: pass. Residual: native radio accent until primitives.
