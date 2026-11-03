## Implementation

- [x] 1. Kit M92: the grey press in `uikit/src/sandbox/canvas.tsx` stops propagation and marks `grayPick`; `uikit/src/sandbox/viewport.tsx` Stack centring skips it (demo walk: row `p0`, "Spread · Page 1 · 1 empty", label y 66.25 → 66.25)
- [x] 2. Kit qa: append the r16 M92 block to `uikit/scripts/qa.mjs` (row, inspector title, label y): 330 passed, 0 failed
- [x] 3. Prod M93: `.spread-page-cut` background `rgb(0 0 0 / 0.1)` in `src/render/SpreadView.css` (via the existing `--thumb-spine` token; css-tokens gate forbids raw colours)
- [x] 4. Prod e2e `e2e/design-r17-prod.spec.ts`: list card cut and canvas fold computed colours (1 passed)

## Manual test scenarios

1. Kit `#/demo` 1440 × 900: spread 2–3, Esc twice, press the grey canvas at (20, 20) → row "1", inspector "Spread · Page 1", page-1 label y unchanged.
2. Prod editor 1440 × 900: a spread-list card centre line is `rgba(0, 0, 0, 0.1)`; the canvas fold keeps its gradient.

- harness problem: `pnpm agent manual-qa` timed out on `start-session` (welcome-screen header intercepts the click) before either scenario; it cannot drive the kit `#/demo` anyway.
- OK 1 (kit qa `uikit/scripts/qa.mjs` r16 M92, 330 passed): before the press no row and "Select a spread or photo"; after it row `p0`, "Spread · Page 1 · 1 empty", label y 52.25 → 52.25. Demo walk (demo-capture `editor-spread-selected`): label y 66.25 → 66.25, scrollTop 557 kept (before the fix: 623.25, scrollTop 0, empty inspector).
- OK 2 (`e2e/design-r17-prod.spec.ts`, 1 passed): list card cut `rgba(0, 0, 0, 0.1)`, width `1px`; canvas fold gradient unchanged.
