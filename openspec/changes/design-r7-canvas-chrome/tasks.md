## Implementation

- [x] 1. M52: remove the size tag span, `sizeLabel`, `writeSizeTag` and `.spread-frame-size-tag`; unit tests assert no size tag.
- [x] 2. M51: wrap the empty / missing hints in `.spread-frame-hints` with `data-camera-frame`; counter-scale it about its centre with `--cam-scale`.
- [x] 3. M51: crop tag, dpi and lock badges carry `data-camera-frame` and counter-scale about their frame corner.
- [x] 4. M51: page cuts carry `data-camera-frame`, centred on the cut and 1 screen px at every zoom; never on thumbs.
- [x] 5. e2e `design-r7-canvas-chrome.spec.ts` (per-rAF zoom samples; select / drag / resize / crop without size tag) and the three size-tag specs flipped to "no size tag exists" (Owner design change, round 7, M52).

## Manual test scenarios

1. 1440×900, empty spread: ctrl-wheel zoom in and out; the "Drop photo" icon and label never grow, shrink or jump and stay centred; the fold stays on the spread centre.
2. Select a frame, resize it with a handle and enter crop: no "mm" pill under the frame.

- 1: OK via e2e `design-r7-canvas-chrome.spec.ts` M51 (per-rAF samples; fails with the hints counter-scale removed: label 0.6 px off at zoom ×0.963).
- 2: OK via e2e `design-r7-canvas-chrome.spec.ts` M52 and the flipped `canvas-frame-chrome` / `inspector` / `preview-no-overlays` specs.
- `pnpm agent manual-qa`: problem (harness entry, not reached): the welcome header intercepts `start-session`, inherited from main.
