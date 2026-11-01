## Decisions

1. M75: kit cover text inherits `line-height: 1.5`; prod had `normal` (front box 43, back 14). Unitless `line-height: 1.5` on `.cover-front-text` / `.cover-back-text`: boxes 51 / 16.5 at Fit, text tops 197.98 / 581.52; the ratio holds at ×2.
2. M79: tokens `--spread-card-shadow` (`0 1px 2px rgb(0 0 0 / .14)`), `--spread-card-radius` (2 px). Spread rows: runtime `.editor-spread-thumb` rule (editorChromeTokens). Page 1 (`data-page-side='right'`): the page takes the card values (kit card clipped at 50 %). Last page (`'left'`): kit `LastPage` → `--cover-shadow-mini`, radius 0 (no other rule rounds `.spread-view--thumb`). M55 geometry stays.
3. M80: kit has no global border colour → `.pb-menu-popover` / `.pb-list-select__popover` border 1 px transparent. Kit `Popover` offset 4 → `MenuPopover` default 6 → 4 (all menus, incl. top bar and filmstrip). `.pb-menu-popover` drops `min-width: 10rem` (unlayered, it beat `min-w-44`): sort menu 176 at x 1198. Width-less callers (Specimen page, `chromeParity.test.tsx`) become content-sized like kit `w-auto`; jsdom tests do not measure width.

## Touch-set & Test Plan

- Files: `styles/tokens.css`, `src/editor/CoverCanvas.css`, `src/editor/SpreadsPanel.css`, `src/editor/editorChromeTokens.ts`, `src/ui/Menu.css`, `src/ui/Menu.tsx`, `src/ui/ListSelect.css`, `docs/design.md`.
- Reuse: `--cover-shadow-mini`; fixtures `openLibraryBook`, `addSpreads`.
- Tests: unit `Menu.test.tsx` (offset 4), `editorChromeTokens.test.ts` (card tokens). e2e `e2e/design-r12-surfaces.spec.ts`: empty (cover without photo, photo-less spreads), M75 Fit / ×2, M79 rows selected / at rest, M80 three menus opened. Skill `ui-review` before push.
