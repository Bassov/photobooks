## Implementation

- [x] 1. KS2: `#/demo` stack on; stack gap 104/588 of the spread height, Fit / zoom shared with the single-spread camera (`viewport.tsx`, `demo-parts/editor.tsx`) — qa "kit-sync KS2"; probe Fit 513.25 / 90.76, ×3 1002.45 / 177.30, floor 128.31 / 22.69
- [x] 2. KS3: page numbers 11 px, 8 px under the page, hidden when the gap < 19 px (`viewport.tsx` `PageLabels`) — qa "kit-sync KS3"; probe 11 px, dy 8 at Fit / ×2 / ×3 / floor
- [x] 3. KS4: fixed-height gap; content-wide 32 px pill centred under the page numbers, hidden when it does not fit (`viewport.tsx` `GapDrop`) — qa "kit-sync KS4"; probe 199.23 × 32, r 8, 19.88 / 19.89 (Fit), 45.42 / 45.42 (×2)
- [x] 4. KS5 + K1: remove the frame size pill; Esc clears the drop chip and dimmed source (`canvas.tsx`) — qa "kit-sync KS5", "kit-sync K1"; probe chip count 0 on frame-drag-cancelled, crop-mode, spread-selected
- [x] 5. Kit qa checks KS2–KS5 + K1, current-spread selectors in qa / demo-capture; regenerate demo baselines — kit qa 243 passed / 0 failed; demo walk 64 steps, no page errors

## Manual test scenarios

1. `#/demo` editor at Fit: spreads stacked, gap ≈ 90.78 px, page numbers 11 px 8 px under the page; zoom ×3 and to the floor (numbers hide only under 19 px gap).
2. Drag a filmstrip photo between spreads: pill shows, gap height unchanged; drag a frame, press Esc: no "Release to replace" chip.
