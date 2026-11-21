# design-r35-filmstrip-end-prod

Tag: lite
Milestone: P5
Title: Bug: /next-roadmap-item design-r35-filmstrip-end-prod

## Scope

- [x] Designer parity M136 (Round 35, walkthrough-ux-review p3): with the filmstrip scrolled to the end, the last thumb ends 4 px from the scroller's right edge (kit), not 12 px. The track width (`spacerWidthPx`) and the window width (last `buildStridePrefix` entry) no longer count a gap after the last thumb; first-thumb origin (M129: x 224, 4 px inset) unchanged.
- **Browser check:** e2e `filmstrip-resize.spec.ts` "the last thumb ends 4 px from the strip end when scrolled to the end (kit)" at H 76 and 92 (DOM gap + paint pixels; 12 px on the old code).
