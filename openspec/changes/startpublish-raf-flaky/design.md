## Decisions

1. Root cause: the module `publishStore` schedules a real `setTimeout` (≤250 ms) per progress burst, then calls the bare global `requestAnimationFrame`. `startPublish.test.ts` drives the real store; a timer that fires after the file's happy-dom teardown (globals removed) or in a node env throws `ReferenceError` outside any test, and Vitest fails the run.
2. Fix at the default clock, not in tests: `requestFrame` looks up `globalThis.requestAnimationFrame` on each call; if it is not a function, it calls `run()` at once (the flush is idempotent: `publish` returns when nothing changed). Browser path unchanged.
3. Callers grepped in `src/editor/publish/**`: `PublishButton.tsx` (subscribe/getSnapshot only, no frames), `startPublish.ts` (dispatch → covered by 2), tests `startPublish`, `PublishButton`, `PublishDialog` (dispatch real store → covered by 2), `publishStore.test.ts` (fake clock, unaffected). No test needs its own clock.

## Touch-set & Test Plan

| Path                                           | Why                                 |
| ---------------------------------------------- | ----------------------------------- |
| `src/editor/publish/publishStore.ts`           | frame fallback in the default clock |
| `src/editor/publish/publishStore.node.test.ts` | new node-env regression test        |

- Reuse: existing `createPublishStore` / `ExportSiteClock`.
- Tests: `// @vitest-environment node` unit with fake timers: start + progress, advance `PUBLISH_PROGRESS_MS`, no throw, snapshot shows the percent. Fails on old code (`ReferenceError`). No e2e (no UI change).
