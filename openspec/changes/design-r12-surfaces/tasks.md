## Implementation

- [ ] 1. M75: cover front / back text line-height 1.5 (`CoverCanvas.css`).
- [ ] 2. M79: spread-card tokens; spread rows, page 1 and last page cards (`tokens.css`, `editorChromeTokens.ts`, `SpreadsPanel.css`).
- [ ] 3. M80: menu / list popovers transparent border, offset 4, no default min-width (`Menu.css`, `Menu.tsx`, `ListSelect.css`).
- [ ] 4. Unit tests for the menu popover and chrome tokens; `e2e/design-r12-surfaces.spec.ts` with kit values in its header.

## Manual test scenarios

1. Cover with title "Lake trip 2026" at Fit: title / back text tops at the kit values; ×2 keeps the ratio.
2. Spread 2–3 selected: list cards rounded 2 px with the kit shadow; page 1 and the last page as in the kit.
3. Library: sort menu and book menu open 4 px under their triggers with no visible border; create-book size list likewise.
