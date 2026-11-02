## Proposal

Roadmap: `docs/roadmap/P2/framestyle-arrange-unhide.md` (scope / Done when / Browser / Perf SoT). UI ref: `uikit#/feature/inspector`.

### Scope out

- Frame style model, ops and history (`src/core/ops/frameLook.ts`, `arrange.ts`) and `src/core/schema.ts`.
- Align & distribute and style colour pickers stay hidden (D2).

### Delta / Risk

- e2e locks empty frame, happy (chips, sliders, z buttons) and interact (style edit, Send to back); scrolling only inside `inspector-body`, no page-level H/V scroll.
