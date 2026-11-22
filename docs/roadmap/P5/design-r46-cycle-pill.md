# design-r46-cycle-pill

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item design-r46-cycle-pill

## Scope

Design Round 46 (Designer parity cycle-layouts 2026-11-22, NOT PASS), two Musts on the layout pill (CL3). Everything
else on the pill passed parity and stays as it is.

- [ ] M155 (prod): the ‹ › tooltips in `src/editor/LayoutCycle.tsx` use the dark top-bar tooltip the panel toggles
      use (`e7-tip` / `e7-tt` markup, CSS in `editorChromeTokens.ts`) instead of the light RAC `Tooltip`; it sits
      6 px above the button (`LayoutCycle.css`), like the kit pill.
- [ ] M156 (kit): `uikit/src/sandbox/layout-cycle.tsx` `.layout-cycle` sets `font-family: inherit`, so the pill uses
      the kit chrome face ("Inter Variable") instead of a fallback for the unregistered "Inter".
- [ ] Tests: `src/editor/LayoutCycle.test.tsx` (tooltip markup), `e2e/cycle-layouts.spec.ts` (hover style, gap,
      paint), `e2e/kit-layout-cycle.spec.ts` (font family, pill and name cell widths).
- **Done when** (1440×900, Fit, spread 2–3): prod hover on ‹ and on › shows the tooltip with bg rgb(83,81,82),
  text rgb(242,242,242), 11px/400, radius 5, padding 3px 7px, key hint opacity .7 margin-left 6, its bottom 6 ±0.5
  above the button, dark ink painted on screen; no RAC tooltip opens. Kit pill font-family resolves to
  "Inter Variable", pill width 226.38 ±0.5, name cell 148.48 ±0.5. Existing cycle-layouts unit/e2e tests stay green.
- **Browser check:** `e2e/cycle-layouts.spec.ts` + `e2e/kit-layout-cycle.spec.ts` (Chromium, 1440×900).
