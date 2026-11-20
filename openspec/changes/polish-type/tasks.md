## Implementation

- [x] 1. Type scale + tracking tokens in `uikit/src/index.css` and `styles/tokens.css`; `--heading-weight` 400; `docs/design.md` Type row (e2e `design-r10-library` Settings h1 400, `kit-library` polish-type)
- [x] 2. Panel caps 0.12em: kit `.eyebrow`, prod `.inspector-eyebrow` / `.eyebrow`, specimen h2, `tracking-[.12em]` → `tracking-caps` (prod + kit) (e2e `design-r9-letter-spacing`, `design-r2-layout-picker`, kit `#/demo` test)
- [x] 3. Display caps 0.20em: welcome, library, Example caption, book object subtitle (prod + kit) (e2e `design-r10-library`, `kit-library`; unit `BookObject.test.tsx`)
- [x] 4. Lora chrome at 400: empty-state title, brand rule (`--heading-weight`)
- [x] 5. Tests: BookObject unit, design-r9 / design-r2 / design-r10-library / kit-library e2e

## Manual test scenarios

1. Welcome → Create library → empty library: caps "WELCOME TO PHOTOBOOKS", "YOUR LIBRARY IS READY", "EXAMPLE" at 0.20em, nothing moves.
2. Library → Settings: h1 at Lora 400.
3. Editor: Spread (Layout…) and Photo (Fit & crop…) inspector titles at 0.12em like Cover / Book.
