## Implementation

- [x] 1. `placedJump.ts` + `placedJump.test.ts`: labels, B3 start, jump per place kind, status texts, nudge only out of view.
- [x] 2. `editorStatus.ts`: `Placed i of n · ` pill pattern (`editorStatus.test.ts`).
- [x] 3. `FilmstripItem.tsx` badge (role=button span, count, labels) + row `aria-keyshortcuts`; `Filmstrip.css` Look table
      (tokens `--placed-badge*` in `styles/tokens.css`).
- [x] 4. `Filmstrip.tsx`: badge click / Enter / double-click → jump after pick precedence; `Filmstrip.test.tsx`.
- [x] 5. `e2e/placed-badge.spec.ts` per Designer spec «Tests» (5 tests green locally).

## Manual test scenarios

1. Photo on pages 2–3 and page 4: click the badge three times → frame on 2–3, frame on 4 with pill `Placed 2 of 2 · Page 4`,
   back to 2–3; zoom unchanged.
2. Focus the placed row, press Enter twice → cycles, focus stays on the row.
3. Drag a placed photo by its badge onto an empty frame → placed.
