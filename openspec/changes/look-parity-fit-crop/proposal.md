## Proposal

Roadmap: `docs/roadmap/M3/look-parity-fit-crop.md`. UI ref: `uikit#/feature/crop-in-frame` (kit `CropSection`).

### Scope out

- Rotate & flip section, filmstrip chrome, frame geometry fields.
- No new crop gestures; pan/zoom/wheel/nudge unchanged.

### Delta / Risk

- Additive optional frame `fit` (`fill` default, no schema bump); painter letterboxes `fit`.
- Observables: nothing selected → no section; filled frame → section; Crop → grey overlay + tag, black chrome hidden; Esc/Done exits.
