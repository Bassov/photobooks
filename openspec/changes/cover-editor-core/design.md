## Decisions

1. Import boundary: the generic profile moves to `print/genericProfile.ts` (exported by `index.ts`; no `profileSchema.ts` re-export, knip flags it unused); `printProfile.ts` and `coverGeometry.ts` import no zod (site bundle). `genericProfile.ts` imports the page range from `pages.ts`, which imports the geometry: the cycle is used at call time only.
2. `spineWidthMm(rule, pages, pageCount)` clamps first; `coverGeometry(profile, book)` takes the profile explicitly (a profile without `manualOverride` stays testable); `bookCoverGeometry(book)` resolves it, unknown id → generic.
3. Rects are mm from the sheet's top-left; safe = profile `safeMarginMm`, frames start at the hinge; `frontPhoto` = front board plus wrap on three edges (D4).
4. `source` is effective: `manual` only with `manualOverride`, then `spine = style.spineWidthMm`.
5. `bookSpineWidthMm` stays in `pages.ts` (callers unchanged) and delegates; `spineWidthForPages` is removed.

## Touch-set & Test Plan

| File                                       | Why                 |
| ------------------------------------------ | ------------------- |
| `src/core/print/profileSchema.ts`          | wrap / hinge fields |
| `src/core/print/genericProfile.ts`         | new                 |
| `src/core/print/coverGeometry.ts`          | new                 |
| `src/core/print/coverGeometry.test.ts`     | unit + PBT          |
| `src/core/print/profileSchema.pbt.test.ts` | arbs, generic       |
| `src/core/pages.ts`                        | delegate            |
| `src/core/pages.test.ts`                   | spine               |
| `src/core/printProfile.ts`                 | zod-free import     |
| `src/core/printProfile.test.ts`            | wrap / hinge        |
| `src/core/cover.ts`                        | keep `print`        |
| `src/core/cover.test.ts`                   | regression          |
| `src/core/index.ts`                        | exports             |

- Reuse: `pagesOf`, `resolvePrintProfile`, `RectMm`.
- Tests: clamp ends, table past the last row, manual on / off, unknown id; PBT sheet = 2·trim + spine + 2·wrap exactly and rects tile the sheet. No e2e (no UI).
