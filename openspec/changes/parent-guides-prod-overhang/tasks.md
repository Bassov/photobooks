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

`pnpm agent manual-qa` (harness problem, not product): all four timed out on the welcome `start-session` click, intercepted by the welcome header. Evidence instead, `e2e/guides-overhang.spec.ts` (DOM measurement, 2/2 pass):

- OK 1–3: "Browser check: guides overhang the page by 24 px on all four sides" — own, parent, Masters and page 1 lines, both ends, `getBoundingClientRect` + `elementFromPoint`, at Fit and zoomed.
- OK 4: "the paper still clips its own content at the slot box" — paper `clip-path` = slot box, a frame moved above the page is cut, its crop ghost runs past the page inside that clip.
