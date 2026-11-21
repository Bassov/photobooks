## Implementation

- [x] 1. `filmstripSize.ts`: H maths, v2 storage, store + `useFilmstripThumbHeight`; unit tests (`src/editor/filmstripSize.test.ts`).
- [x] 2. `FilmstripDock.tsx`: separator (pointer, keys, double-click), CSS vars; unit tests (`src/editor/FilmstripDock.test.tsx`).
- [x] 3. `Filmstrip.tsx`: virtualisation and `--film-slot-h` from H; update unit pins (`Filmstrip.test.tsx` "feeds the separator height H …").
- [x] 4. `Filmstrip.css` (+ pill fill in `editorChromeTokens.ts`): separator, pill, chip, focus ring, name strip, empty row, open bottom panel overflow.
- [x] 5. e2e: new `filmstrip-resize.spec.ts`; rewrite `design-filmstrip-fixed.spec.ts`; `design-r3-chrome.spec.ts` + `a5-fit-parity.spec.ts` empty dock.
- [x] 6. `uikit/scripts/demo-capture.mjs`: `editor-filmstrip-resized` step (walk: 90 steps OK, shot 13 shows 128 px thumbs with names).

## Manual test scenarios

1. Editor at 1440 × 900 with photos: thumbs 76 px; hover the dock top edge → pill; drag up 52 px → 128 px thumbs with a "128 px" chip, chip gone on release; file names under thumbs; reload keeps 128.
2. Focus the separator (Tab): ↑ / ↓ / Home / End / Enter change H; no page scroll.

manual-qa (2026-11-21): problem (harness) — both scenarios blocked at the welcome screen (`start-session` click intercepted by the welcome header, 30 s timeout), no product step ran. Covered instead by e2e `e2e/filmstrip-resize.spec.ts`: 1 → "drag the separator: 4 px steps to 128, chip painted only while dragging, names, reload keeps H"; 2 → "keys ↑/↓ ±8, Home, End, Enter and double-click; no page scroll" (both green locally).
