## Implementation

- [x] 1. History key override + `discardStep` (`bookStore.ts`, `bookHistory.ts`), `textEditStore.ts` (start / commit / discard, per-spread subscribe).
- [x] 2. Text tool in `frameGesture.ts`: click 60 × 14 mm in the safe area, drag draft min 10 × 4.5 mm, press over photo frames, press on a text frame edits; text frames move by their body.
- [x] 3. `TextEditOverlay.tsx` (+ css): transparent textarea, whole-line growth, Esc / Ctrl+Enter / blur commit; `SpreadView` / `ConnectedSpreadView` editing chrome, dbl-click and Enter edit.
- [x] 4. Overflow chips + overflow ids in `textEditStore.ts` (fonts before measure, constant screen size, inside near the paper bottom, editor only).
- [x] 5. Drop exclusion: `dropSpreadsFromBook` skips text, text activation never swaps.
- [x] 6. Text inspector: `TextSection.tsx` ("Text style" / "Align text" / per-focus typing steps), view `text` in `Inspector.tsx` / `inspectorModel.ts`, align glyphs.
- [x] 7. `e2e/text-frames.spec.ts` (Done when flows + INP ≤ 100 ms over 200 chars); pinned tests stay unchanged; PR body carries the inspector dy and chip DOM measurements.

## Manual test scenarios

1. Text tool: click on paper → a 60 × 14 mm frame is editing; type `Morning`; Esc → stays selected; Esc → deselected.
2. Text tool: drag over a photo → a text frame on the photo; leave it empty → it disappears, Undo shows the previous step.
3. Select a text frame → Enter edits; Inspector Style Title → Overflow chip under the frame and `Text overflows the frame`; Preview shows no chip.
