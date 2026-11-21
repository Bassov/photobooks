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

manual-qa (stage 9): problem (harness) — all 3 blocked at the welcome screen: the `start-session` click is intercepted by
the `welcome-screen` header (known harness issue), the editor was never reached. Covered by e2e instead:
1 → `e2e/placed-badge.spec.ts` "clicks cycle the places with the pill…"; 2 → "Enter on the focused row cycles and keeps
focus…"; 3 → "a drag from the badge places the photo…" (5/5 green locally).

ui-review: pass — tokens `--placed-badge*` in docs/design.md; keyboard path = row Enter (`aria-keyshortcuts`), label with
count; hover / pressed / pick / reduced-motion states; status is text, not colour; DOM + paint measured in e2e.
