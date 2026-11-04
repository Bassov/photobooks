## Implementation

- [x] 1. `ConnectedSpreadView`: editor-layer stage wrapper with `GuidesOverlay` as the paper's sibling; Preview stays bare (unit test)
- [x] 2. `GuidesOverlay` / `guideGesture`: paper lookup and pull preview via the stage (unit tests updated)
- [x] 3. CSS: `--guide-overhang`, slot `overflow-clip-margin`, paper `clip-path` = old slot box, right-page margin on the stage
- [x] 4. e2e `guides-overhang.spec.ts`: own + parent + Masters overhang on 4 sides at Fit and high zoom, single first page, paper clip unchanged; parent-guides locators via the slot

## Manual test scenarios

1. Two-page spread, guides on: pull a vertical and a horizontal guide — both reach 24 px past the page at each end; zoom in — still 24 px.
2. Master A child spread: dashed parent guides reach 24 px past the page on all sides.
3. Masters canvas: a master guide reaches 24 px past the page on all sides.
4. Crop mode on a frame at the page edge: the photo ghost stays clipped at the page edge.
