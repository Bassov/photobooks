# crop-in-frame

Tag: feature
Milestone: M3
Title: non-destructive crop

## Scope

- [ ] Pan / zoom inside a frame (pointer, wheel, keyboard nudge), reset to cover
- **Perf:** crop preview is a `transform` on the image in rAF; the crop op is committed at gesture end; a higher tier is requested when crop zoom exceeds the current tier. Gate: pan a crop for 5 s — zero LoAF, `pointermove` p95 ≤ 2 ms.
- **Browser check:** reposition a photo inside its frame smoothly; reload keeps the crop.
- **UI ref:** `uikit#/feature/crop-in-frame`
