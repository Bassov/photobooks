## Implementation

- [x] 1. `PhotoFrameSections` + `frameSectionSummaries`: collapsed FRAME STYLE / ARRANGE / ADJUST summaries from book state; `Inspector.tsx` renders it (unit tests).
- [x] 2. POSITION & SIZE: `FrameLockButton` on the title row; `GeometrySection` without the lock row; Frame rotation on the `fit-crop-slider--row` pitch (unit tests).
- [x] 3. ADJUST: `InspectorSlider` `className`, row pitch 35.8, kit padding, Reset adjustments as ghost `Button` (unit tests).
- [x] 4. Kit `MmField` metrics on `.fit-crop-field` (left-aligned values) and Frame style panel padding / chip leading.
- [x] 5. `e2e/design-r11-photo.spec.ts`: kit values in the header; each section expanded and collapsed (empty: Reset disabled, "None", "z 1"; happy: kit dy; interact: Bring forward → "z 2"), ppi chip states, M60 values, no page-level scroll.

## Manual test scenarios

1. 1440 × 900, filled frame selected, collapsed: no summary (ADJUST, POSITION & SIZE), "None" (FRAME STYLE), "z 1" (ARRANGE); expand each: rows at the kit pitch, lock on the title row, values left-aligned.
2. Draw two frames, select the back one, Bring forward: ARRANGE collapsed reads "z 2"; pick "White mat": FRAME STYLE reads "White mat".
