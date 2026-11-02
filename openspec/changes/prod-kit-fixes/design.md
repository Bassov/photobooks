## Decisions

1. **P1.** `EditorSettings` reuses the library back bar: class `pb-settings-back` (kit gap / padding / `--foreground` ink, `libraryScreenStyles.ts`) and `ensureLibraryScreenStyles()` at module load, so the rule never depends on the library having rendered. Label `Back to the book` (kit `demo-parts/settings.tsx:84`). Other back links: library Settings (`Library`, already right); the top-bar `Library` link leads out of the editor, not into it.
2. **P2.** One rule: `.film-chip` in `editorChromeTokens.ts` takes `border-radius: calc(infinity * var(--radius-full))` (pill, passes `check:css-tokens`). It covers Add folder…, Unplaced and Added order.
3. **P3.** `formatNumber` keeps at most `decimals` digits and drops trailing zeros (`19`, `12.5`). `NumberField` gets an opt-in `live` prop: while typing, a parseable draft is clamped and sent to `onChange` without clearing the draft; blur / Enter still normalise. A partial draft below min reports min (typing `2` → hint `… × 10`), accepted: kit `create-book.tsx:32-34` clamps its hint the same way. Only `CreateBookDialog` passes it.

## Touch-set & Test Plan

| Path                               |
| ---------------------------------- |
| `src/editor/EditorSettings.tsx`    |
| `src/editor/editorChromeTokens.ts` |
| `src/ui/numberField.ts`            |
| `src/ui/NumberField.tsx`           |
| `src/editor/CreateBookDialog.tsx`  |

- Unit: `EditorSettings.test.tsx` (label, class), `editorChromeTokens.test.ts` (chip rule), `numberField.test.ts` (`19`, `12.5`, rounding), `forms.test.tsx` (`live` incl. below-min draft; plain field waits for blur; `1.0` → `1` at :307), `CreateBookDialog.test.tsx` (H 23 → `19 × 23 cm` without blur; W `19`; `18.0` / `42.0` → `18` / `42`). `src` + `e2e` grepped for `.0` field values: no other pins.
- e2e: `design-create-library-chrome.spec.ts` editor Settings (text, ink rgb(57,55,56), label x 38); `kit10-filmstrip.spec.ts` three chips radius ≥ 9999 px, height 28.
