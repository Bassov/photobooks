# Tasks

## 1. Decision

- [x] 1.1 Add the frame MIME, payload encode/decode, `isFrameDrag`, and `resolveFrameActivation` in `src/editor/dropTargets.ts`. Click passes the gallery asset (gallery wins: place/replace, else select-source, else swap, else noop). A frame drop passes the payload and no gallery asset (another frame is swap, including empty; the same spread and frame is noop). Verify unit tests for both input shapes and a payload round-trip
- [x] 1.2 Add `frameSelection` outside the document, mutually exclusive with gallery selection via a re-entry guard. Add `frameSelection.ts` to `EDITOR_MUTATE` in `scripts/stryker-diff.mjs` and to `mutate` in `stryker.config.json`. Verify a unit test that setting either selection clears the other

## 2. Drop

- [x] 2.1 Extend `installGalleryDrop` so a frame `dragstart` caches the same index and parses the payload once. Measured `dragover` calls `resolveFrameActivation` with no gallery asset; a hit is one `swap`; a self-hit, miss, or zoom gesture does not dispatch. Verify a pasteboard test: synthesized `dragstart` then `dragover` sets `data-drop-hover` on one frame, a drop swaps or moves, and a self-drop leaves the book unchanged
- [x] 2.2 On `filmstrip-scroll`, frame `dragover` only prevents default, sets `dropEffect` `move`, and hovers that scroller (no `getData` or hit-test). `drop` reads the payload and dispatches one `unplace`. Outline that hover in `Filmstrip.css`. Verify a filmstrip test that the drop clears the dragged frame and the photo stays in the gallery

## 3. Keyboard

- [x] 3.1 Pass `onDragStart` only for a filled frame; the inner body is the drag source, not the button. Labels: empty and no source stays “Place photo”; “Replace photo” only when a gallery photo is selected and the frame is filled; otherwise “Select photo to move”, “Swap photos”, or “Move photo here”. `aria-pressed` only on the keyboard source. A dragstart flag ignores that gesture’s click. The filmstrip shows “Unplace” only while a source is set and that control unplaces it. Verify component tests for the labels, pressed state, keyboard swap/move/unplace, and that a selected gallery photo still replaces

## 4. Browser scenarios

- [x] 4.1 Add `e2e/drag-swap.spec.ts`: empty gallery has no Unplace control, no Placed badge, and activation leaves “Place photo” placeholders; keyboard swap keeps both badges; move onto an empty frame; unplace clears the badge when that photo has no other placement; `assertDocumentFitsViewport`; `dragstart` then `dragover` moves `data-drop-hover` onto one frame and then onto `filmstrip-scroll`
- [x] 4.2 Add a `frame-budget gates` scenario in that file: `/?fixture=painter&perf=1`, `dragstart` with the frame MIME, zoom until every spread is mounted, dispatch `dragover` across the book, assert zero LoAF and `dragover` p95. Add the file to the `pnpm perf` script

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

- Archive after implementation review passes, syncing delta specs.
- Tick `drag-swap-unplace` in `docs/roadmap.md` in the same branch, without waiting for merge.
- Open the PR with a Manual testing section, then wait for CI and add tests if coverage or mutants ask for them.
