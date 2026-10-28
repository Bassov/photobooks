## Implementation

- [x] 1. Grid/snap view state + keys (Ctrl+', Shift+S) — gridView.test, installEditorGridKeys.test
- [x] 2. Overlay restyle with gray tokens (dashed box, column fill, row bands) — GridOverlay.test
- [x] 3. TopBar "Layout grid" toggle with quiet pressed state — e2e/layout-grids-render-snap.spec.ts
- [x] 4. Pure `gridSnap` + `snapHint` + `SnapLabel` — gridSnap.test, GridOverlay.test
- [x] 5. Unit + e2e tests; design.md tokens

## Manual test scenarios

1. Show grid → dashed margins + columns/rows match inspector C×R; hide → gone.
