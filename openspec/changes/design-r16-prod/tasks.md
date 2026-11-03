## Implementation

- [x] 1. M83: one kit title button with `aria-pressed` + pressed fill; one-line truncation at 1024–1233 px (`EditorTopBar.test.tsx` "pressed while open"; `e2e/design-r16-prod.spec.ts` M83).
- [x] 2. M84: Contact sheet button pushed to the row's right edge (`e2e/design-r16-prod.spec.ts` M84).
- [x] 3. M85: `pageFillLowRes` helper reusing `frameDpi` / `lowDpi` + boundary unit tests (`pageFillLowRes.test.ts`).
- [x] 4. M85: filmstrip "Low-res" chip from stored pixel dims, follows trim changes (+ `Filmstrip.test.tsx` "Low-res chip (r15 M85)").
- [x] 5. `e2e/design-r16-prod.spec.ts` with the kit values in its header (`--repeat-each=30`: 150 passed).

## Manual test scenarios

1. Editor at 1440 × 900: click the book title → Book settings opens, the title block is filled and pressed.
2. Select a spread → Contact sheet sits at the right edge of the Layout row.
3. Add a small photo → "Low-res" chip at its thumb's top-left; a 24 MP photo has none.
4. Resize to 1024 px → title block stays on one line with `…`.

`pnpm agent manual-qa` (2026-11-03): problem (harness) for 1–4: the click on `start-session` timed out (30 s) because the welcome header intercepts pointer events, so the editor was never reached. Covered by `e2e/design-r16-prod.spec.ts` (scenario 1: M83 pressed test; 2: M84; 3: M85; 4: 1024 / 1233 px tests), 150/150 with `--repeat-each=30`.
