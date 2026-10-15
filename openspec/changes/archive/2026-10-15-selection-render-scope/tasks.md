# Tasks

## 1. Gallery snapshot

- [x] 1.1 Add `getGalleryPhotoSelected` and `subscribeGalleryPhotoSelected` in `src/editor/gallerySelection.ts`. The getter is true only when a gallery asset id is selected. The subscriber listens to the raw gallery store and notifies only when that boolean changes. Verify in `src/editor/frameSelection.test.ts` that selecting a different photo while one stays selected does not notify, that appearing and clearing the selection do notify, and that unsubscribe stops further calls

## 2. Frame source key

- [x] 2.1 Add `getSpreadFrameSourceKey` and `subscribeSpreadFrameSource` in `src/editor/frameSelection.ts`. The key is `null` when no source exists, `''` when a source exists on another spread, or that frame id when the source is on this spread. The subscriber notifies only when that string changes. Verify unit tests that `null`, `''`, and the frame id are distinct, that moving the source between frames on another spread does not notify, that setting, clearing, and moving the source onto this spread do notify, and that unsubscribe stops further calls

## 3. Spread subscription

- [x] 3.1 Point `ConnectedSpreadView` at the two derived snapshots. Map `null` through, map `''` to a `FrameSource` whose spread is not this spread, and map a frame id to `{ spreadId, frameId: key }` with pressed taken from that same key. Keep `frameControlLabel`. Do not read the raw gallery id or raw frame source. Verify the component no longer imports `getSelectedAssetId`, `subscribeGallerySelection`, `getFrameSource`, or `subscribeFrameSelection`

- [x] 3.2 In `ConnectedSpreadView.test.tsx`, reuse `twoSpreadBook` and `mountSiblingPaint`, profile both spreads, and apply `4-grid` to `s0`. Changing the selected photo id does not increase either render count. Changing the source frame on `s0` does not increase `s1`'s count. Setting a source, clearing it, and moving the source onto `s1` each increase `s1`'s count. Assert Place/Replace, Cancel move, and Swap/Move names. Reset gallery and frame selection in the existing `afterEach`

## 4. Roadmap line

- [x] 4.1 After the `drag-swap-unplace` item in `docs/roadmap.md`, add only `- [ ] [prep] \`selection-render-scope\` — a spread re-renders on selection only when its own labels change`. Leave it unchecked until archive. Verify that no other new checkbox was added

## Verification

- [x] pnpm typecheck
- [x] pnpm lint
- [x] pnpm test
- [x] pnpm test:e2e (or pnpm verify) — `pnpm verify` exit 0 (one drag-place keyboard test flaked once, passed on retry)
- [x] pnpm stryker:diff — 93.75 on `frameSelection.ts` and `gallerySelection.ts` (threshold 60)
- [x] pnpm test:lhci when UI or bundle size is affected (N/A — no UI or bundle change)
- [x] UI in scope: browser smoke evidenced (empty + happy + primary scroll/interact via Playwright and/or MCP browser); skill `ui-review` pass (N/A — prep; visible labels unchanged; no new scrollport)
- [x] Agent docs: if module map / commands / security surface / durable conventions changed → update AGENTS.md (≤150 lines); update .cursor/rules or skills only when a lasting convention changed; do not add alwaysApply rules without merging/removing another (N/A — no map or convention change)
- [x] pnpm audit:ci when package.json/lockfile or security-tagged change (N/A — no package, lockfile, or security-surface change)
- [x] Launch openspec-design-reviewer was pass before apply (evidenced) — pass, agent 21c99682
- [x] Launch Cursor subagent `openspec-implementation-reviewer`; resolve findings before archive — pass, agent ee7486db; medium test isolation fixed before archive
- [x] High-risk security surface: Cursor Security Review subagent before archive (N/A — no File System Access, workers, blob URLs, CSP, dependency, or export change)

## Workflow follow-up

- Archive only after the implementation reviewer passes, syncing the `spread-view` delta.
- Tick the `selection-render-scope` roadmap checkbox in that archive.
- Commit, push `feat/selection-render-scope`, and open the pull request.
