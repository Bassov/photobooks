## Implementation

- [x] 1. e2e `e2e/design-r9-letter-spacing.spec.ts`: kit values in the header; per-state type assertions for every audited title; M48 row tops (fails before the fix). Burn-in `--repeat-each=30`: 180 passed.
- [x] 2. Shared `.inspector-eyebrow.inspector-sec-title` (0.12em) in `EditorShell.css`; drop the dead `.endpaper-sec-title` tracking.
- [x] 3. Apply `inspector-sec-title` to the Cover, Book settings and Endpaper `Sec` titles; unit tests lock the class split (`BookSettingsKit`, `CoverParity`, `bookLookUi`, `LayoutSection` tests).
- [x] 4. `docs/design.md` Type row names the `Sec` title tracking.

## Manual test scenarios

1. 1440 × 900, 19 × 23 book: select the cover, the book title and "Endpaper · front"; uppercase titles match the kit tracking (same-environment widths: FILL 26.28 px, APPLY 41.61 px, kit equal). Select a spread and a photo frame: Disclosure titles unchanged (0.66 px).

- problem (harness): `pnpm agent manual-qa` blocked at the welcome screen; the start-session click is intercepted by the welcome `<header>`. Covered instead by `e2e/design-r9-letter-spacing.spec.ts` (all six states, 180/180 burn-in) and the before/after crops in `.cache/agent/evidence/`.
