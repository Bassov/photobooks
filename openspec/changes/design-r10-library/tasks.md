## Implementation

- [x] 1. `kitTypeStyles.ts`: upright-only Lora display family + `.pb-kit-type` line-height scope, with unit tests.
- [x] 2. M64 Library: weight 400 + normal tracking on "Your books", empty headline and book-object titles; empty-library margins (figure, h1, p, Create book); credit link colour.
- [x] 3. M65 Welcome: headline margin, last paragraph margin, display family, kit line-heights; credit margin.
- [x] 4. M66 Settings: title line-height, kit line-heights, success badge, back button padding/gap/border (ink: design-r10-chrome).
- [x] 5. `e2e/design-r10-library.spec.ts` asserting kit values; `docs/design.md` Type row.

## Manual test scenarios

1. 1440 × 900 Welcome: text block centred like the kit; credit top-right at 24 px.
2. Empty library: example book + text column; Create book opens the dialog.
3. Library with one book → Settings → back to Library.

`pnpm agent manual-qa --change design-r10-library` (2026-11-01):

- 1–3: expected pass / observed locator.click timeout (30s) on getByTestId('start-session'): the welcome `<header>` intercepts the click (harness problem, not a product mismatch). Covered by `e2e/design-r10-library.spec.ts` (M65 welcome, M64 empty and one-book library, M66 settings → back; 120 passed at repeat-each=30) and `e2e/library-screens.spec.ts`.
