## Implementation

- [x] 1. Node-env regression test `src/editor/publish/publishStore.node.test.ts` (red on old code: `ReferenceError: requestAnimationFrame is not defined`; plus a frame-still-deferred case).
- [x] 2. Default `requestFrame` in `src/editor/publish/publishStore.ts` falls back to a direct flush without `requestAnimationFrame`.

## Manual test scenarios

N/A — no UI change; the browser path still flushes in an animation frame (covered by `publishStore.test.ts` and e2e).
