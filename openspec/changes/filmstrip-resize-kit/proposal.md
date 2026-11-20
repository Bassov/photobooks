## Proposal

Roadmap: `docs/roadmap/P5/filmstrip-resize-kit.md` (scope / Done when / Browser SoT). UI ref: `uikit#/demo` editor photos dock.

### Scope out

- Prod filmstrip (`src/**`) and the `#/demo` step `editor-filmstrip-resized`: later item `filmstrip-resize`.
- Frame chrome / crop (direct-crop-kit lane); `qa.mjs` stays frozen.

### Delta / Risk

- No spec delta (kit-only). e2e covers empty, happy and interact per roadmap Done when; no page-level scroll, the strip scrolls only inside `filmstrip`.
- The open dock panel stops clipping so the separator's 5 px above the edge is hittable.
