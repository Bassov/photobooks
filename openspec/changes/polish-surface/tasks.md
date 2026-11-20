## Implementation

- [ ] 1. P4: `--radius-full: 9999px` in kit + prod `@theme` and token blocks; top-bar pills on `var(--radius-full)`
- [ ] 2. P5: `--shadow-book`, `--shadow-book-hover`, `--page-shadow` on rgb(20 20 19), kit + prod
- [ ] 3. P7: `--warning-ink: #845510` (kit + prod, `--ink-warning` aliases it); PRINT warnings, prod + kit Print Check warning rows use it
- [ ] 4. Pins: BookSettingsPrinter unit, top-bar / library pill, page-shadow, PRINT warning e2e; new `e2e/polish-surface.spec.ts` token + radius probes; `docs/design.md`

## Manual test scenarios

1. Prod 1440 × 900, open a book: top-bar Preview pill radius 9999px.
2. Print → Check: a warning row reads rgb(132, 85, 16).
3. The spread page shadow is on rgba(20, 20, 19, …).
