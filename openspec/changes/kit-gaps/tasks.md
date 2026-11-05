## Implementation

- [x] 1. `canvas.tsx`: export `FRAME_LOCKED_STATUS`; the drag uses it.
- [x] 2. `viewport.tsx`: Del / Backspace delete the selected unlocked frames (locked stay selected; none unlocked → locked status). e2e `kit-frame-keys.spec.ts` "Del deletes…", "Del keeps a locked frame…".
- [x] 3. `viewport.tsx`: all-locked Arrow / Shift+arrow → no update, locked status. e2e "ArrowRight on an all-locked selection…".
- [x] 4. `e2e/kit-frame-keys.spec.ts`: Del / Backspace counts, locked survives, text editor, all-locked nudge rects + painted status (4 passed; `uikit:qa:quick` 379 passed).

## Manual test scenarios

1. `/uikit/#/demo` editor, spread 4: select a frame → Del removes it; Shift-select two → Backspace removes both.
2. Lock a frame → Del keeps it; lock two, select both → ArrowRight: nothing moves, the locked status shows.
3. Text tool, type in the editor → Del / Backspace edit text only.
