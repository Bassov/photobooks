## Decisions

1. M80 cause: `.pb-button[data-pressed]` scales by `--motion-press-scale` (0.98), and React Aria keeps `data-pressed` on a MenuTrigger's button while the menu is open. The kit Button has no press scale. Fix in the shared primitive (`src/ui/Button.css`): `.pb-button[data-pressed][aria-expanded='true'] { transform: none }`. The brief press on plain buttons stays (docs/design.md Motion). No menu offset change.
2. Callers that pick the rule up (all `pb-button` menu triggers): library "Book actions" (`LibraryScreen.tsx`), spread-list page actions (`SpreadsPanel.tsx`), top-bar Zoom (`EditorTopBar.tsx`). Library sort, filmstrip sort, layout-tile menu and the create-book size list are plain `AriaButton`s with no scale, already the kit.
3. M81: the Caption hint becomes the kit `div` with `leading-[1.4]` (`text-xs` keeps 12 px; 16.8 px line). A `div` drops the `p`'s 12 px bottom margin (UA `margin-block: 1em`, no preflight reset in the app; prod measured `6px 0 12px`), so the section loses 12 − 0.8 = 11.2 px.

## Touch-set & Test Plan

- Files: `src/ui/Button.css`, `src/editor/FrameLookSections.tsx`, `e2e/design-r13-polish.spec.ts`, roadmap item, `docs/design.md` (Motion row: no scale on an open menu trigger).
- Reuse: `openLibraryBook`, photo picker fixtures, `dragPlaceFirstFilmstripItem` (as in `design-r12-*` specs). Tokens: `--motion-press-scale`, `text-xs`, `text-muted-foreground`.
- Tests: e2e `design-r13-polish.spec.ts`: book menu trigger 28 × 28 / `transform: none` / menu y 476 / gap 4 / Open y; spread-row and Zoom triggers `transform: none` while open; plain button still scales while pressed; Caption hint tag / margin / line-height and Position & size dy 121.8. Unit: `Button.test.tsx` is CSS-blind under jsdom, so the CSS is locked by e2e.
