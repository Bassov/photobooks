# design-canvas-camera

Tag: feature
Milestone: P1
Title: Prod parity: canvas camera, top air, fit default, chips

## Scope

- [ ] Camera: centred world + pan, cursor-anchored wheel zoom, centre-anchored key/button zoom, 56px top air, Fit default, one spread at a time
- [ ] Low-res chip only with DPI view; remove status chips, empty overlay, idle hint pills
- **Done when:** e2e/design-canvas-camera.spec.ts passes
- **Browser check:** open a book; first spread has >=56px air; wheel zoom keeps the point under the cursor; no page-level H/V scroll
- **UI kit:** uikit/src/sandbox/viewport.tsx (camera, FIT_TOP/FIT_BOTTOM); UI ref: uikit#/demo
