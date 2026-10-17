# zoom-image-tiers

Tag: feature
Milestone: M1
Title: sharp images at every zoom

## Scope

- [x] Zoom-aware image tiers: smallest preview covering on-screen size × DPR; worker generates tiers into a bounded in-memory LRU
- **Perf:** tier switch after the gesture settles with `img.decode()` before swap. Gate: the `camera-zoom-pan` zoom scenario with tier switches — zero LoAF.
- **Browser check:** zoom from the whole book to a single photo detail and back; images stay sharp, no flashes, no stutter.
- **UI ref:** `uikit#/feature/zoom-image-tiers`
