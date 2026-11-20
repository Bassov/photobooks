## Implementation

- [x] 1. P4: `--radius-full: 9999px` in kit + prod `@theme` and token blocks; top-bar pills on `var(--radius-full)` (e2e/polish-surface.spec.ts, design-r11-topbar, library-screens)
- [x] 2. P5: `--shadow-book`, `--shadow-book-hover`, `--page-shadow` on rgb(20 20 19), kit + prod (e2e/polish-surface.spec.ts, design-r11-canvas, design-r3-spread-shadow)
- [x] 3. P7: `--warning-ink: #845510` (kit + prod, `--ink-warning` aliases it); PRINT warnings, prod + kit Print Check warning rows use it (printer-presets, design-r31-cover-check, design-r16-prod)
- [x] 4. Pins: BookSettingsPrinter unit, top-bar / library pill, page-shadow, PRINT warning e2e; new `e2e/polish-surface.spec.ts` token + radius probes; `docs/design.md`

## Manual test scenarios

1. Prod 1440 × 900, open a book: top-bar Preview pill radius 9999px.
2. Print → Check: a warning row reads rgb(132, 85, 16).
3. The spread page shadow is on rgba(20, 20, 19, …).

manual-qa 2026-11-21: harness problem — all three blocked at the welcome screen (`start-session` click intercepted by the welcome header), no product check ran. Covered instead by e2e: 1 → polish-surface + design-r11-topbar (9999px) OK; 2 → design-r31-cover-check + printer-presets (rgb(132, 85, 16)) OK; 3 → design-r11-canvas + design-r3-spread-shadow (rgba(20, 20, 19, …)) OK.
