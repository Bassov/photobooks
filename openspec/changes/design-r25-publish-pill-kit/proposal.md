## Proposal

Roadmap: `docs/roadmap/P3/design-r25-publish-pill-kit.md` (scope / Done when / Browser). UI ref: `uikit#/feature/in-app-publish`.

### Scope out

- Prod (`src/**`): its Publish pill already hovers to rgb(215).
- The sandbox `.e7-sec:hover` rule (`uikit/src/sandbox/v7.tsx`) stays; other sandbox screens use it.

### Delta / Risk

- UI observables locked by e2e: happy = `#/demo` editor, hovered Publish pixel = hovered Preview pixel = rgb(215); idle Publish keeps 73.58×32, padding 0 14. Empty / scroll: N/A (one class on one pill).
