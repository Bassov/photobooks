## Decisions

1. M83: kit markup: one `button.e7-title` (`aria-label="Book settings"`, `aria-pressed` = `isBookSettingsSelected`) holding the title span (`book-title`) and the size span (`book-size`, `shrink-[999]`). The start group copies the kit `min-w-0 max-w-full`, so the size text truncates first. Pressed fill: one `editorChromeTokens.ts` rule.
2. M84: unlayered `.pb-button { margin: 0 }` beats `ml-auto`, so use `ml-auto!`.
3. M85: `pageFillLowRes(trim, px)` = `lowDpi(frameDpi(page, sourceCropRect(page, fill)))` (canvas badge functions, one threshold). `FilmstripItemView` reads it via `subscribeBookStore` from `getAssetPixelSizeSnapshot` (no decode), so trim edits update it.

## Touch-set & Test Plan

| Path                                | Why                         |
| ----------------------------------- | --------------------------- |
| `src/editor/EditorTopBar.tsx`       | M83                         |
| `src/editor/EditorShell.css`        | dead CSS                    |
| `src/editor/editorChromeTokens.ts`  | pressed fill                |
| `src/editor/LayoutSection.tsx`      | M84                         |
| `src/editor/pageFillLowRes.ts`      | M85 rule                    |
| `src/editor/pageFillLowRes.test.ts` | boundary                    |
| `src/editor/FilmstripItem.tsx`      | M85 chip                    |
| `src/editor/Filmstrip.css`          | chip tokens                 |
| `styles/tokens.css`                 | kit `--ink-warning` #845510 |
| `src/editor/EditorTopBar.test.tsx`  | aria-pressed                |
| `src/editor/Filmstrip.test.tsx`     | chip, trim                  |
| `e2e/design-r16-prod.spec.ts`       | kit values                  |

- e2e: kit values ±0.5 px, exact colours / radius / aria-pressed, 1024 / 1233 px; skill `ui-review` before push.
