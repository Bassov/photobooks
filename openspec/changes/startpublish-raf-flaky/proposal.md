## Proposal

Roadmap: [`docs/roadmap/P3/startpublish-raf-flaky.md`](../../../docs/roadmap/P3/startpublish-raf-flaky.md) (scope / Done when).

### Scope out

- `src/editor/export/exportSiteStore.ts` has the same global `requestAnimationFrame` default; off limits (`src/editor/export/**`), left for its own item.
- No Vitest config change (unhandled errors stay fatal); no spec delta (browser behaviour unchanged).

### Delta / Risk

- The default `requestFrame` reads `globalThis.requestAnimationFrame` when a flush runs; when it is missing (node, or a test env after teardown) it runs the flush at once. Browsers still flush in a frame.
