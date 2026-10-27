## Implementation

- [ ] 1. Core: `clampCrop`, `setCrop` / `resetCrop` ops, history coalesce key (+ unit/PBT)
- [ ] 2. `cropMode` store (enter / exit rules) (+ unit)
- [ ] 3. `SpreadView` crop-active rendering (ghost, unclipped, not draggable)
- [ ] 4. `cropGesture`: pan / wheel / nudge / Esc with rAF transform and commit (+ unit)
- [ ] 5. Tier request scaled by crop zoom (+ unit)
- [ ] 6. Inspector Fit & crop section (zoom slider, Reset to cover)
- [ ] 7. e2e: pan, reload keeps crop, reset, Esc; perf pan 5 s

## Manual test scenarios

1. Double-click a photo, drag it, wheel-zoom, arrow-nudge, Reset to cover, Esc; reload keeps the crop.
