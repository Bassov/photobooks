## Implementation

- [ ] 1. e2e `e2e/design-r11-topbar.spec.ts` with kit values (red first).
- [ ] 2. Panel toggles: ON fill via `aria-expanded`, `SUB` colour, padding 0.
- [ ] 3. Preview + Settings pills (`EditorTopBar.css`), 6 px group gap.
- [ ] 4. Undo / Redo 32 × 32, flush.
- [ ] 5. Zoom menu padding 0 8, no min width, ghost hover.
- [ ] 6. Unit tests for the changed files; `docs/design.md` line.

## Manual test scenarios

1. 1440 × 900, open a book, select spread 1: toggles on read rgb(215) / rgb(83, 81, 82); hide photos, toggle off reads transparent.
2. Hover: ON toggle stays rgb(215); Preview / Settings stay rgb(215) / rgb(57, 55, 56); Zoom menu and zoom ± read rgb(207) / rgb(57, 55, 56); Undo / Redo are 32 × 32.
