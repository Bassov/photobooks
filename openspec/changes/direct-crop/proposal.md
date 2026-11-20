## Proposal

Roadmap: `docs/roadmap/P5/direct-crop.md` (scope / Done when / Browser). UI ref: `uikit#/demo` `editor-frame-selected`, `editor-photo-layer-hover`, `editor-photo-scaled`, `editor-frame-cropped-by-edge`.

### Scope out

- Pinned state (double-click / Crop) stays today's crop mode (next item).
- Small-frame handle rules; rotate knob.

### Delta / Risk

- Frame handle resizes keep the photo on the page instead of re-cropping it; e2e locks empty (no grabber), happy (layer painted on hover), interact (edge crop, pan, scale, Fit→Fill).
