## Implementation

- [x] 1. Unit tests first: `CoverParity.test.tsx` expects `fill-readonly` = `#3E3C3B` + `fill-swatch` for a default book and `#112233` for `backFill: '#112233'` (red before task 2, green after).
- [x] 2. `CoverSection.tsx` Fill row: swatch + upper-case hex (design D1–D2).
- [x] 3. Kit `v7.tsx:277` Fill row matches; `qa.mjs` KS10 lookup follows it (D3–D4; `uikit:qa:quick` row tops unchanged, Fill x 1347.86).
- [x] 4. e2e: M6 in `design-r2-cover-book.spec.ts` checks the visible row; `design-filmstrip-cover` and `design-inspector-book-cover` old Fill asserts updated (18/18 green).

## Manual test scenarios

1. `?fixture=` editor → Cover → inspector Back section: Fill row shows a charcoal swatch and `#3E3C3B`, no "coming later"; the canvas back is the same colour.

- problem (harness, not product): `pnpm agent manual-qa --change cover-back-fill` blocked at the welcome screen — the header intercepts the `start-session` click (known harness issue). Covered instead by e2e M6 `design-r2-cover-book.spec.ts` (`fill-readonly` = `#3E3C3B`, `fill-swatch` rgb(62, 60, 59), no "coming later" in `insp-cover`) and `design-inspector-book-cover.spec.ts:90,108`; the canvas back fill is unchanged (`src/render/CoverView.tsx` untouched).
