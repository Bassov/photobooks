# Tasks

## 1. Camera math

- [x] 1.1 Add `src/editor/camera.ts`: `zoomAtPoint` (anchor stays fixed; transform is `translate(anchor * (1 - ratio)) scale(ratio)` from committed scroll and zoom), `fitZoom` for the active spread (`contain` and `width`), `fitStackZoom` as the whole-stack minimum, physical 100% as `(96 / 25.4) / SPREAD_PX_PER_MM`, and a clamp whose max is at least 400% physical. Key step is `2 ** 0.25`. Verify with unit tests and a fast-check property that zooming at a point keeps that viewport anchor on the same content point, including a two-pointer pinch (distance ratio, midpoint) that matches `zoomAtPoint`.

## 2. Camera store

- [x] 2.1 Add `cameraStore` with committed zoom and live zoom. Wheel and pinch update live zoom only. `+` / `-` and fit actions write live and committed zoom together. Verify with a unit test that a live-only update does not notify committed subscribers, and that a key zoom notifies both.

## 3. Committed layout

- [x] 3.1 `SpreadView` accepts `pxPerMm` (default `SPREAD_PX_PER_MM`). `ConnectedSpreadView` and pasteboard stride use `SPREAD_PX_PER_MM * committedZoom`. `CameraBar` (Fit spread, Fit width, 100%, percent text, visible focus ring) sits with `SpreadTemplateBar` outside `pasteboard-scroll`. Verify: default zoom still paints 150 / 300 px spreads; choosing 100% in a component test sets the indicator to 100%.

## 4. Gestures

- [x] 4.1 Add `usePasteboardCamera`. Only the inner `pasteboard-world` gets the transient transform; the scrollport is not transformed. Ctrl/Cmd+wheel is non-passive, `preventDefault` only then, sync body under `measureHandlerSync('wheel-zoom')`, DOM writes in rAF, `will-change` only during the gesture, commit after ~80 ms idle. Pinch is two Pointer Events with `preventDefault` and `touch-action: none` while both are down. Space+drag pans `scrollLeft` / `scrollTop` in rAF. While the transient transform is set, mounted slots skip `content-visibility`. Verify: a live-only zoom leaves the mounted `[data-testid=pasteboard-slot]` count unchanged.

## 5. Browser lock-in

- [x] 5.1 Playwright: a normal visit shows three empty spreads, a zoom percent, and `assertDocumentFitsViewport`. 100% reads 100%. Fit width matches the active spread to the port width. Fit spread fits the active spread in the port. Ctrl+wheel or `+` changes on-screen size. A two-pointer pinch changes size. Space+drag changes `pasteboard-scroll`. When a spread is wider than the port, `assertNamedScrollport` confines horizontal scroll to `pasteboard-scroll` and the document does not scroll. The painter fixture at whole-book zoom mounts one `pasteboard-slot` per spread.

## 6. Frame budget

- [x] 6.1 Add a `frame-budget` scenario that zooms the painter fixture from the whole book to 400% physical and back, asserts zero LoAF and wheel-zoom handler p95, so `pnpm perf` runs it.

## Verification

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify)
- [x] pnpm stryker:diff
- [x] pnpm test:lhci when UI or bundle size is affected
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass
- [x] Agent docs: if module map / commands / security surface / durable conventions changed → update AGENTS.md (≤150 lines); update .cursor/rules or skills only when a lasting convention changed; do not add alwaysApply rules without merging/removing another
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change
- [x] Launch openspec-design-reviewer was pass before apply (evidenced)
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive
- [x] High-risk security surface: Cursor Security Review subagent before archive

## Workflow follow-up

- Archive `camera-zoom-pan` with delta specs synced into `openspec/specs/`
- Tick `camera-zoom-pan` in `docs/roadmap.md` in the same PR, without waiting for merge
