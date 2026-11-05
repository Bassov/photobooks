## Implementation

- [ ] 1. `liveCaption.ts` pure helpers (chip titles, anchor options, token insert) + unit/PBT.
- [ ] 2. Live block in `TextSection.tsx` / `.css` (switch, Anchored to, chips; `ToggleSwitch` disabled, `braces` glyph, labelled dispatch) + `TextSection.test.tsx`.
- [ ] 3. Template while editing: `textEditStore.ts` + `TextEditOverlay.tsx` + unit test.
- [ ] 4. `SpreadView` `TextNode` memo + unit test.
- [ ] 5. EXIF meta JPEG fixtures + `e2e/live-captions.spec.ts` (functional flows, inspector y positions).
- [ ] 6. Painter fixture `&captions=4` + perf gate (swap, 0 LoAF).

## Manual test scenarios

1. Select a text frame under a photo: Live off shows the switch and 4 chips; click chip `date` → Live on, Anchored to shows the frame, canvas shows the date.
2. Drop another photo on the anchor frame → caption updates; switch off → swap again → caption unchanged.
3. Delete the anchor frame → caption static; Undo → Live again.
