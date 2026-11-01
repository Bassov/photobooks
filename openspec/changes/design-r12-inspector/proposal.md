## Proposal

Roadmap: `docs/roadmap/P1/design-r12-inspector.md` (scope / Done when / Browser / Perf SoT). UI ref: `uikit#/demo` steps `editor-frame-selected`, `editor-crop-mode`.

### Scope out

- M78 FRAME STYLE / ARRANGE sections (Owner question pending).
- Shared `src/ui` Field / Button base styles; cover text inputs.

### Delta / Risk

- CSS only, scoped to inspector classes. e2e locks the happy state (frame selected: field radius/shadow, Caption offsets) and the interact state (Crop → Done shadow); no empty state or scrollport changes.
