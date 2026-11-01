## Implementation

- [ ] 1. e2e `e2e/design-r9-letter-spacing.spec.ts`: kit values in the header; per-state type assertions for every audited title; M48 row tops (fails before the fix).
- [ ] 2. Shared `.inspector-eyebrow.inspector-sec-title` (0.12em) in `EditorShell.css`; drop the dead `.endpaper-sec-title` tracking.
- [ ] 3. Apply `inspector-sec-title` to the Cover, Book settings and Endpaper `Sec` titles; unit tests lock the class split.
- [ ] 4. `docs/design.md` Type row names the `Sec` title tracking.

## Manual test scenarios

1. 1440 × 900, 19 × 23 book: select the cover, the book title and "Endpaper · front"; uppercase titles are as wide as the kit (FILL 27.23 px, APPLY 42.11 px). Select a spread and a photo frame: Disclosure titles unchanged (0.66 px).
