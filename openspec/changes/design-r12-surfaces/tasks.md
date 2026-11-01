## Implementation

- [x] 1. M75: cover front / back text line-height 1.5 (`CoverCanvas.css`). Evidence: `design-r12-surfaces.spec.ts` M75 Fit / ×2.
- [x] 2. M79: spread-card tokens; spread rows, page 1 and last page cards (`tokens.css`, `editorChromeTokens.ts`, `SpreadsPanel.css`). Evidence: spec M79, `editorChromeTokens.test.ts`.
- [x] 3. M80: menu / list popovers transparent border, offset 4, no default min-width (`Menu.css`, `Menu.tsx`, `ListSelect.css`). Evidence: spec M80, `Menu.test.tsx`.
- [x] 4. Unit tests for the menu popover and chrome tokens; `e2e/design-r12-surfaces.spec.ts` with kit values in its header (150/150, `--repeat-each=30`).

## Manual test scenarios

1. Cover with title "Lake trip 2026" at Fit: title / back text tops at the kit values; ×2 keeps the ratio.
2. Spread 2–3 selected: list cards rounded 2 px with the kit shadow; page 1 and the last page as in the kit.
3. Library: sort menu and book menu open 4 px under their triggers with no visible border; create-book size list likewise.

manual-qa (`pnpm agent manual-qa --change design-r12-surfaces`, 2026-11-02):

- problem (harness, not product): scenarios 1–3 blocked at the welcome screen; `start-session` (1 × 1 px) click is intercepted by the welcome header. Same known harness issue as earlier rounds.
- OK (e2e substitute): `e2e/design-r12-surfaces.spec.ts` covers scenarios 1–3 through the real entry flow, 150/150 with `--repeat-each=30 --workers=4`.
