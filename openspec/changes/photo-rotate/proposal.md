## Proposal

Scope / acceptance SoT: `docs/roadmap/P2/photo-rotate.md` (UI ref: `uikit#/feature/inspector`, `PhotoRotateSection`).

### Scope out

- Flip H/V and frame (not photo) rotation changes.
- Cover / endpaper panel rotation (spread frames only).

### Delta / Risk

- Crop gains quarter turns + straighten angle (schema fields already exist); cover fit is recomputed in `shownCropRect`. UI observables: empty frame has no Rotate section; happy path turns/straightens and stays covered; reload keeps both (`e2e/photo-rotate.spec.ts`). No scrollport change.
- Security surface: N/A.
