## Implementation

- [x] 1. `PhotoFrameSections.tsx`: `FRAME_STYLE_AND_ARRANGE_VISIBLE = false` switch; Frame style / Arrange not rendered by default; unit tests (hidden by default, prop on keeps summaries). Evidence: `PhotoFrameSections.test.tsx` "hides Frame style and Arrange behind the Owner Q8 switch".
- [x] 2. Delete frame kit wrapper (x 1168, w 244, y last section + 28) and `--destructive` ink / hover in `FrameSections.tsx` / `.css`; unit tests. Evidence: `FrameSections.test.tsx` `p-7`; e2e filled-frame test.
- [x] 3. Unit tests that assert Arrange in the Inspector (`FrameSections.test.tsx`, `Inspector.test.tsx`) flip to the hidden state.
- [x] 4. New `e2e/design-r14-hide-framestyle.spec.ts` (count 0, order, pitch, Delete frame, scrollport). Evidence: 1380/1380 at `--repeat-each=30`.
- [x] 5. Existing e2e flip only FRAME STYLE / ARRANGE assertions to the hidden state (Owner Q8, M78 hidden).

## Manual test scenarios

1. 1440 × 900, open a book, place a photo, select the frame: inspector ends ADJUST, CAPTION, POSITION & SIZE, Delete frame; no Frame style / Arrange rows or "New style from this frame"; Delete frame ink is dark (not muted).
2. Select an empty frame: same list, no Frame style / Arrange.
