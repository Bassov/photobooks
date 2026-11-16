# startpublish-raf-flaky

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item startpublish-raf-flaky
Status: done

## Scope

- [x] The default `requestFrame` of the module `publishStore` (`src/editor/publish/publishStore.ts`) runs the flush at once when `requestAnimationFrame` is missing (node, or a test env after teardown); browsers still flush in a frame.
- [x] A node-env test (`publishStore.node.test.ts`) fails on the old code with `ReferenceError: requestAnimationFrame is not defined`.
- **Done when:** `pnpm vitest run src/editor/publish` passes 10 runs in a row with 0 unhandled errors.
- **Browser check:** N/A (no UI change).
