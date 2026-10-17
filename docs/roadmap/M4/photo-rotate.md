# photo-rotate

Tag: feature
Milestone: M4
Title: rotate photos in frames

## Scope

- [ ] Rotate 90° left / right and straighten (±45°) inside a frame; cover fit recomputed; keyboard shortcuts
- **Perf:** straighten preview is a `transform` in rAF, committed at gesture end. Gate: straighten drag for 5 s — zero LoAF, `pointermove` p95 ≤ 2 ms.
- **Browser check:** rotate a sideways photo 90° and straighten a tilted horizon; the frame stays covered; reload keeps both.
- **UI ref:** `uikit#/feature/photo-rotate`
