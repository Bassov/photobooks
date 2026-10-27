## Decisions

1. Pure model `assetsPanelModel.ts`: `buildAssetRows(book, statuses)` (id, name, status, uses, spread numbers, first frame), `sortAssetRows(rows, 'status'|'uses')` (stable; ties by gallery order), `rowWindow(scrollTop, viewportH, rowH, count, overscan)`.
2. Rows are fixed height; virtualized by hand (spacer + absolutely positioned window), same approach as Filmstrip. Scroll handler only sets window start; no per-row subscriptions to scroll.
3. Store snapshots stay synchronous (`useSyncExternalStore`); rows built in `useMemo`; sort key set via `useState` inside `startTransition`, store-driven rebuild via `useDeferredValue` (gate: zero LoAF with 1000 assets).
4. UI primitives: `EmptyState` ("No photos yet"), `Badge` (success ok / warning modified / error missing), `SegmentedControl` sm, existing thumb loader (`ensureThumb`/`getThumbUrl`); dashed missing placeholder and fixed row height are local CSS on existing tokens — no new tokens. Skill `ui-review` before push.
5. Jump: `scrollPasteboardToSpread(spreadId)` (frame selection is skipped: `setFrameSource` starts move mode). Update: `acceptModifiedAsset(id)` — patches identity (cache key changes → thumbs refresh), frame crop untouched; status line message. If no staged match, status line says to rescan from the relink dialog.
6. `LeftPanel` (Pages | Assets) in `EditorShell` uses plain `role=tab` buttons replacing the panel header, not `SegmentedControl`: the radio group in the always-mounted Pages view tripped the autosave-during-drag LoAF gate. Panel keeps current width.
7. Security: no new surface; Update only consumes Files already staged by relink rescan.

## Touch-set & Test Plan

- Files: `src/editor/assetsPanelModel.ts`, `AssetsPanel.tsx`, new `LeftPanel.tsx` (wraps SpreadsPanel | AssetsPanel), `EditorShell.tsx`, `EditorShell.test.tsx`, `EditorShell.css`, `openspec/specs/assets-panel/spec.md`.
- Reuse: `placementCountByAsset`, relink `statusStore`, `thumbCache`, `Badge`, `SegmentedControl`, `acceptModifiedAsset`, `scrollPasteboardToSpread`.
- Tests: unit for model (rows, sort, window) + PBT (sort is a permutation, window bounds); component tests (empty, happy, sort, jump, Update); e2e `assets-panel.spec.ts` (tab switch, status rows, sort, jump, scroll only in `assets-list`, no page scroll) + perf scenario 1000 assets scroll+sort zero LoAF.
