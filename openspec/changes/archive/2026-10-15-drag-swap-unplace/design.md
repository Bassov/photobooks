# Design

## Context

See proposal.md. `swapFrames` moves into an empty frame and no-ops an identical pair; do not change it. `installGalleryDrop` caches the drop index at `dragstart`, and `onDragOver` returns when `session` is null. `.spread-frame[data-drop-hover]` is the only hover style. `SpreadView` must not import `src/editor`.

## Goals / Non-Goals

**Goals:**

- Frame `dragover` reuses the cached index and allocates nothing.
- Click and frame-drop call `resolveFrameActivation` with different inputs.

**Non-Goals:**

- Rebuilding the frame map during `dragover`
- `draggable` on the frame `<button>`

## Decisions

1. **Payload in `dropTargets.ts`.** MIME `application/x-photobooks-frame` is `spreadId` + `\n` + `frameId`, parsed once at `dragstart` and again on `drop` (`getData` is empty during `dragover`). `isFrameDrag` checks types only. Alternative: JSON on every `dragover` (rejected).

2. **Pasteboard session.** `installGalleryDrop` starts a session for either MIME. Frame `dragover` uses the measured path and `dropEffect` `move`. It calls `resolveFrameActivation` with the parsed payload as source and no gallery asset. Another frame returns `swap` (empty target included). The same `spreadId` and `frameId` returns `noop`. A miss or `data-gesture` clears hover and does not dispatch. Gallery MIME stays place/replace and does not pass the frame payload.

3. **Filmstrip drop.** `Filmstrip` listens on `filmstrip-scroll` for the frame MIME. `dragover` calls `preventDefault`, sets `dropEffect` `move`, and `setDropHover` on that scroller. No `getData`, hit-test, or layout read. `drop` reads the MIME and dispatches `unplace` for that pair. The Unplace button alone uses `frameSelection`.

4. **Drag source and names.** `FrameControl` gains optional `pressed` and `onDragStart`. The inner body is `draggable` only when `onDragStart` is set, and `ConnectedSpreadView` sets that only for a filled frame. `aria-pressed` is only the keyboard source. An empty frame with no source stays “Place photo”. “Replace photo” is a filled frame while a gallery asset is selected. Otherwise a filled frame is “Select photo to move”, another filled frame is “Swap photos”, and an empty frame with a source is “Move photo here”. The filmstrip control is named “Unplace”. `dragstart` sets a flag so that gesture’s click does not also activate. Outline for `[data-testid="filmstrip-scroll"][data-drop-hover="true"]` goes in `Filmstrip.css`.

5. **Click inputs.** `frameSelection.ts` holds `{ spreadId, frameId } | null` outside the document. Setting a gallery asset clears it, and setting it clears the gallery asset, with a re-entry guard. Click passes the gallery asset and the frame source: gallery wins (`place` / `replace`); else no source and the frame is filled → select source; else a different frame → `swap`; else `noop`.

## Risks / Trade-offs

- [Frames mounted after dragstart are missing from the map] → the perf gate mounts every fixture spread
- [Playwright HTML drag is flaky] → behavior e2e uses the keyboard; hover and perf synthesize drag
- [Inner drag also clicks the button] → the dragstart flag suppresses that activation

## Touch-set

- `src/editor/dropTargets.ts`, `frameSelection.ts`, `galleryDrop.ts`, `gallerySelection.ts`, `Filmstrip.tsx`, `Filmstrip.css`
- `ConnectedSpreadView.tsx`, `src/render/SpreadView.tsx`
- `e2e/drag-swap.spec.ts`; `package.json` `perf` includes that file
- `scripts/stryker-diff.mjs`: add `frameSelection.ts` to `EDITOR_MUTATE` (`dropTargets.ts` is already listed)

## Tests and UI

Public API: `isFrameDrag`, payload round-trip, and `resolveFrameActivation` (gallery-first click versus a frame drop with no gallery asset, including same-frame `noop` and empty-target `swap`). Pasteboard and Filmstrip cover one `swap` or `unplace`. Reuse `assertDocumentFitsViewport` and the photo fixtures.

E2E empty: no Unplace control, no Placed badge, activation leaves placeholders. Happy: keyboard swap keeps both badges; move onto an empty frame; unplace clears the badge when that photo has no other placement. Interact: `dragstart` then `dragover` moves `data-drop-hover` onto one frame, then onto `filmstrip-scroll`. Perf block title `frame-budget gates`: `dragstart` with the frame MIME, then `dragover` across the mounted `/?fixture=painter&perf=1` book; zero LoAF and `dragover` p95.

Skill `ui-review` (layout smoke included) runs before push.

## Composition

`render` receives callbacks only. MIME, selection, and ops stay in `editor`. `galleryDrop` calls `resolveFrameActivation`.
