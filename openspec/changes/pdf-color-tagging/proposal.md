## Proposal

Roadmap: `docs/roadmap/P4/pdf-color-tagging.md` (scope / Done when SoT).

### Scope out

- Color conversion (no pixel math): the source profile is carried, not applied; CMYK / gray profiles that do not match the image stay untouched.
- Preflight UI and wiring it into the Print dialog (pure function only).
- PDF/X OutputIntent.

### Delta / Risk

- The sRGB profile is built in code (ICC v2 matrix/TRC, ~2.3 KB) to avoid a new dependency; Adobe RGB / Display P3 are recognised by their D50 primaries, falling back to the description text.
