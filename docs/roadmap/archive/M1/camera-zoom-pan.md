# camera-zoom-pan

Tag: feature
Milestone: M1
Title: zoom and pan

## Scope

- [x] Ctrl/Cmd+wheel and pinch zoom around the cursor, `+` / `-`, fit spread, fit width, 100%; Space+drag pan; zoom indicator
- **Perf:** camera is one `transform` written in rAF outside React; `will-change` only while zooming; zoom indicator updates through a narrow subscription. Gate: continuous zoom from whole book to 400% and back — zero LoAF, wheel handler p95 ≤ 2 ms. If whole-book zoom fails, do `far-zoom-lod`.
- **Browser check:** zoom from the whole book to a single photo detail and back without stutter (images may stay soft until `zoom-image-tiers`).
- **UI ref:** `uikit#/feature/camera-zoom-pan`
