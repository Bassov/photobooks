## Implementation

- [x] 1. Add `ui-is-presentational` dependency-cruiser rule; touch `.skip-specs` — `pnpm deps` OK
- [x] 2. Implement Button (`default`/`secondary`/`ghost`) / IconButton+Tooltip / ToggleButton / SegmentedControl / Toolbar (RAC + tokens CSS); note aliases in `docs/design.md` — session wiring moved to `src/main.tsx`
- [x] 3. Extend `?specimen` with actions section covering inventory states — `data-testid=specimen-actions`
- [x] 4. Component unit tests through public props — `src/ui/*Button*.test.tsx` etc.
- [x] 5. Verify (`pnpm check` / e2e changed); ui-review; tick roadmap scope — `pnpm verify:fast:quiet` OK; `pnpm test:e2e:changed:quiet` OK
- [x] 6. Manual QA; archive / roadmap done / finish — `playwright test e2e/design-tokens.spec.ts` 4 passed

## Manual test scenarios

1. OK Open `/?specimen`: actions section — Save click, Fit segmented, Undo tooltip, Editor tools toolbar; specimen scrollport
2. OK Open `/` (empty home): Photobooks visible; no page-level H/V scroll
3. OK Open `/?fixture=painter`: editor-shell; filmstrip + pasteboard scrollports; no page-level scroll

### ui-review

- Design system: Button/IconButton/Toggle/Segmented/Toolbar use Theme B tokens; inventory aliases documented in `docs/design.md`. Pass.
- A11y: labelled IconButtons; Segmented radiogroup; Toolbar role; focus-visible rings via `--ring`; reduced-motion on press scale. Pass.
- Layout smoke (e2e): empty `/`, painter pasteboard scrollport, specimen vertical scrollport + actions interact. Pass.
- Anti-slop: tokens only; no purple/glow. Pass.
