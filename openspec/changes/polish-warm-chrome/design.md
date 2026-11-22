## Decisions

1. Map by hex wherever the old hex is a live chrome fill: `#C8CACB→#C9C7C3`, `#E1E1E1→#E3E1DD`, `#D7D7D7→#D8D6D2`, `#CDCDCD→#CCC9C4`, `#CFCFCF→#CDCAC5`. Unlisted gradient stops stay.
2. Tokens first (`docs/design.md`): `--t-bg` / `--t-canvas`, `--t-bar` / `--t-panel` / `--t-raised`, `--t-field`, `--accent`, `--border` (+ prod `--t-field-hover`); prod `BAR` / `FIELD` and Tailwind arbitrary classes copy them.
3. Contrast stays ≥ 4.5, so derived neutrals stay.
4. kit-tokens R=G=B and tinted-surface checks exempt exactly the P10 tones.

## Touch-set & Test Plan

| File                                      | Why                          |
| ----------------------------------------- | ---------------------------- |
| `styles/tokens.css`                       | prod tokens                  |
| `uikit/src/index.css`                     | kit tokens                   |
| `src/editor/editorChromeTokens.ts`        | `BAR`, `FIELD`, title active |
| `src/editor/libraryScreenStyles.ts`       | gradient, quiet field        |
| `src/editor/HostingSetup.tsx`             | fills                        |
| `src/editor/SettingsScreen.tsx`           | nav hover                    |
| `src/ui/SegmentedControl.css`             | comment                      |
| `src/ui/SpecimenPage.tsx`                 | note                         |
| `uikit/src/features/library.tsx`          | gradients                    |
| `uikit/src/demo-parts/editor.tsx`         | quiet field                  |
| `uikit/src/demo-parts/library.tsx`        | gradient                     |
| `uikit/src/demo-parts/hostingSetup.tsx`   | fills                        |
| `uikit/src/kit/Shell.tsx`                 | demo link                    |
| `uikit/src/sandbox/v7.tsx`                | constants, hovers            |
| `uikit/src/sandbox/context-inspector.tsx` | hovers                       |
| `uikit/src/sandbox/chrome.tsx`            | comments                     |
| `uikit/scripts/qa.mjs`                    | `--t-bg` pin                 |
| `docs/design.md`                          | palette                      |
| `openspec/specs/filmstrip/spec.md`        | dock tone                    |
| `e2e/kit-warm-chrome.spec.ts`             | paint check                  |
| `e2e/kit-tokens.spec.ts`                  | P10 exemptions               |

Tests: old-palette unit / e2e pins move, same intent. New spec: prod + kit editor at 1440×900, computed + pixel paint of top bar, canvas, Preview field (happy). Existing `library-screens` (empty bar, fields) and `printer-presets` / `frame-context-menu` (hover pixels) lock empty and interact.
