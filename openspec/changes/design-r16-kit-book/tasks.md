## Implementation

- [x] 1. M89: endpaper canvas caption 8 px under the spread (`uikit/src/sandbox/viewport.tsx` `PageLabels`) — qa `r15 M89` PASS `{"fs":"12px","dy":8}`
- [x] 2. M91: endpaper spine = prod's 1 px 18 % black line (`uikit/src/sandbox/v7.tsx` `EndpaperSpread`) — qa `r15 M91` PASS `w 1, dx -0.01, color(srgb 0 0 0 / 0.18), grads 0`
- [x] 3. M90: cover inspector front thumb `shrink-0`, 42 × 52 (`uikit/src/sandbox/v7.tsx`) — qa `r15 M90` PASS `42 × 52, copy x 1210 / 1210`
- [x] 4. Kit qa: append M89–M91 number assertions to the kit-sync W4 block (`uikit/scripts/qa.mjs`) — `qa:quick` 319 passed, 0 failed

## Manual test scenarios

1. `uikit#/demo` at 1440 × 900, Endpapers on, select the front endpaper: "Endpaper" caption 8 px under the spread; a 1 px dark line at the spine, no soft gradient band.
2. Select the cover: the front thumb is 42 × 52, "No photo yet" and "Drag a photo…" start at x 1210.
