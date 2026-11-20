## Proposal

Roadmap: `docs/roadmap/P5/direct-crop-core.md` (scope / Done when / Browser / Perf SoT). Designer Spec `walkthrough-ux-review` §A "Core".

### Scope out

- Handles, gestures, history label and UI (prod item `direct-crop`); kit (`direct-crop-kit`).
- Multi-select and layout resizes keep `resizeFrame`.

### Delta / Risk

- The op takes an optional `aspectRatio`: the editor knows the decoded aspect; without it the asset record's oriented `widthPx / heightPx` is used (else 1, as `resolveSpread`).
