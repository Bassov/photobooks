## Implementation

- [ ] 1. M52: remove the size tag span, `sizeLabel`, `writeSizeTag` and `.spread-frame-size-tag`; unit tests assert no size tag.
- [ ] 2. M51: wrap the empty / missing hints in `.spread-frame-hints` with `data-camera-frame`; counter-scale it about its centre with `--cam-scale`.
- [ ] 3. M51: crop tag, dpi and lock badges carry `data-camera-frame` and counter-scale about their frame corner.
- [ ] 4. M51: page cuts carry `data-camera-frame`, centred on the cut and 1 screen px at every zoom; never on thumbs.
- [ ] 5. e2e `design-r7-canvas-chrome.spec.ts` (per-rAF zoom samples; select / drag / resize / crop without size tag) and the three size-tag specs flipped to "no size tag exists" (Owner design change, round 7, M52).

## Manual test scenarios

1. 1440×900, empty spread: ctrl-wheel zoom in and out; the "Drop photo" icon and label never grow, shrink or jump and stay centred; the fold stays on the spread centre.
2. Select a frame, resize it with a handle and enter crop: no "mm" pill under the frame.
