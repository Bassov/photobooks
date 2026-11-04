## Decisions

1. One pure helper `foliosOf(doc, s, si)` in `model.ts` returns `{ side, x, y, w, h, align, text }` in spread mm; canvas and Preview paint from it, the master `#` chip reuses `folioBox(grid, P, H, pos, side)`. Margins = the parent's effective grid (`effectiveGrid` without the spread's own grid); safe `FOLIO_SAFE = 5`.
2. Position lives in `MASTER_POS` (synced from `Master.pos` like `MASTER_PN`); format on `Doc.pageFormat`, start / skip on the existing `Doc.pageStart` / `skipFirst`, written through `st.update` (undoable).
3. Folios render after `parentFrames`, before `s.frames`; spread 0 paints the right page only.
4. The `#` chip sizes in container units (`cqw` of its page), so it is true scale at any master canvas size.
5. Kit primitives (`Sec`/`Row`/`Toggle`/`SegC`/`Val`, docs/design.md inspector rhythm); `SegC` and `Toggle` gain optional `label`/`tid`. docs/design.md gains the folio look line (Inter 3.1 mm, #232220, tabular-nums).

## Touch-set & Test Plan

| Path                             | Why              |
| -------------------------------- | ---------------- |
| `uikit/src/sandbox/model.ts`     | folio model      |
| `uikit/src/sandbox/canvas.tsx`   | folio paint      |
| `uikit/src/sandbox/v7.tsx`       | inspectors, chip |
| `uikit/scripts/demo-capture.mjs` | demo step        |
| `uikit/scripts/qa.mjs`           | kit10 asserts    |
| `docs/design.md`                 | folio look       |

- Tests (kit qa, Playwright): Show off → 0 folios, no seg; Outer/Centre/Inner folio x per page and folio top y, in mm via the spread px/mm (±0.5 px at Fit); Skip first → none on page 1; roman text; Book settings link opens `insp-book`; section order Page size / Binding / Page numbers / Print / Defaults and Page numbers section height 179.37 px (PRINT shift); 0 folios in the spread list.
