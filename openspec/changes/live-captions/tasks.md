## Implementation

- [x] 1. `liveCaption.ts` pure helpers (chip titles, anchor options, token insert) + unit/PBT. Evidence: `src/editor/liveCaption.test.ts` (f0a4180b).
- [x] 2. Live block in `TextSection.tsx` / `.css` (switch, Anchored to, chips; `ToggleSwitch` disabled, `braces` glyph, labelled dispatch) + `TextSection.test.tsx`. Evidence: `src/editor/TextSection.test.tsx` `Live block` (f0a4180b, eee7e20e).
- [x] 3. Template while editing: `textEditStore.ts` + `TextEditOverlay.tsx` + unit test. Evidence: `src/editor/TextEditOverlay.test.tsx` "a live caption edits its template" (f0a4180b).
- [x] 4. `SpreadView` `TextNode` memo + unit test. Evidence: `src/render/SpreadView.textMemo.test.tsx` (f0a4180b).
- [x] 5. EXIF meta JPEG fixtures + `e2e/live-captions.spec.ts` (functional flows, inspector y positions); fixes the head-pass patch lost between enqueue and gallery flush (`bookStore.test.ts`). Evidence: eee7e20e.
- [x] 6. Painter fixture `&captions=4` + perf gate (swap, 0 LoAF). Evidence: `e2e/live-captions.spec.ts` `frame-budget gates`, `painterFixture.test.ts` (eaec94fb).

## Manual test scenarios

1. Select a text frame under a photo: Live off shows the switch and 4 chips; click chip `date` → Live on, Anchored to shows the frame, canvas shows the date.
2. Drop another photo on the anchor frame → caption updates; switch off → swap again → caption unchanged.
3. Delete the anchor frame → caption static; Undo → Live again.

manual-qa (2026-11-05): problem (harness) — `start-session` click intercepted by the welcome header, editor never reached; scenarios 1–3 not exercised by manual-qa. Coverage: `e2e/live-captions.spec.ts` (chip date → canvas, drop on anchor updates, Make static holds on swap, delete anchor → static + undo → Live; 7 passed locally).
