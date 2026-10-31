## Proposal

Roadmap: `docs/roadmap/P1/design-r3-spread-shadow.md` (scope / Browser SoT). UI ref: kit `#/demo` `shadow-page`; M36 deviates on purpose.

### Scope out

- Kit token, `uikit/`, `#/demo`, `App.tsx`.
- Canvas Fit geometry (`design-r3-canvas-fit`).

### Delta / Risk

- UI: happy/interact per spec scenario; empty = numbers hide under a 19 px gap. No page-level H/V scroll; only `pasteboard-scroll` scrolls.
- Risk: gesture-only `--cam-scale` costs a style recalc per gesture frame (perf gates).
