## Implementation

- [x] 1. e2e `e2e/spread-thumb-backing.spec.ts`: two-page spread and master rows on a 15 × 21 cm book paint nothing beside the paper (fails on main: box `box-shadow` was `rgba(0, 0, 0, 0.14) 0px 1px 2px 0px`; passes after 2).
- [x] 2. `editorChromeTokens.ts`: the kit card rule targets `.editor-spread-thumb > .spread-view--thumb` (`editorChromeTokens.test.ts` red first, then green); dead single-page box override dropped from `SpreadsPanel.css`; scratch `e2e/zz-measure-thumb.spec.ts` deleted.
- [x] 3. `design-r12-surfaces.spec.ts` M79: card values read from the paper, box shadow none (r7 / r8 / r12 specs green).

## Manual test scenarios

1. Open a 15 × 21 cm book with three spreads: rows 2–3 and 4–5 show white paper on the list background with only the paper's soft shadow; page 1 and the last page look as before; the Masters tab thumb has no grey sides.
