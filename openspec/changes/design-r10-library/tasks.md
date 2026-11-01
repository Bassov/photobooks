## Implementation

- [ ] 1. `kitTypeStyles.ts`: upright-only Lora display family + `.pb-kit-type` line-height scope, with unit tests.
- [ ] 2. M64 Library: weight 400 + normal tracking on "Your books", empty headline and book-object titles; empty-library margins (figure, h1, p, Create book); credit link colour.
- [ ] 3. M65 Welcome: headline margin, last paragraph margin, display family, kit line-heights; credit margin.
- [ ] 4. M66 Settings: title line-height, kit line-heights, success badge, back button padding/gap/border (ink: design-r10-chrome).
- [ ] 5. `e2e/design-r10-library.spec.ts` asserting kit values; `docs/design.md` Type row.

## Manual test scenarios

1. 1440 × 900 Welcome: text block centred like the kit; credit top-right at 24 px.
2. Empty library: example book + text column; Create book opens the dialog.
3. Library with one book → Settings → back to Library.
