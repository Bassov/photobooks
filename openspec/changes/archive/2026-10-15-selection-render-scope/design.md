# Design

## Context

See proposal.md. `ConnectedSpreadView` reads `getSelectedAssetId` and `getFrameSource`. `frameControlLabel` already depends on three facts: a gallery photo is selected, a move source exists, and that source is a frame on this spread. `useSyncExternalStore` skips a render when `Object.is` says the snapshot is unchanged, and snapshots must be referentially stable.

## Goals / Non-Goals

**Goals:**

- The view subscribes to two derived primitives, not the raw stores.
- A photo id change that stays selected, and a source move on another spread, do not notify this spread.

**Non-Goals:**

- Changing `frameControlLabel` or the filmstrip's raw subscriptions.
- A new store module, scrollport, or perf scenario.

## Decisions

1. **Gallery snapshot in `gallerySelection.ts`.** `getGalleryPhotoSelected()` is `getSelectedAssetId() !== null`. `subscribeGalleryPhotoSelected` listens to the raw gallery store and calls its listener only when that boolean changes. Alternative: compare inside the view (rejected: every spread would still subscribe to the raw id).

2. **Per-spread source key in `frameSelection.ts`.** `getSpreadFrameSourceKey(spreadId)` returns `null` when no source exists, `''` when a source exists on another spread, or that frame id when the source is on this spread. `subscribeSpreadFrameSource` listens to the raw frame store and calls its listener only when that string changes. `useSyncExternalStore` compares strings, so a source moving between frames on another spread stays `''` and does not wake this spread. Alternative: a `{ kind, frameId }` object (rejected: a new object every read re-renders).

3. **View maps the key, it does not read the raw source.** `frameControlLabel` still takes `FrameSource | null`. `null` is passed through. `''` becomes a non-matching source (a spread id that is not this spread), so every frame on this spread stays Swap/Move and none is pressed. A real frame id becomes `{ spreadId, frameId: key }`; pressed is that same key equal to the item's frame id. `galleryPhotoSelected` replaces `galleryAssetId !== null`.

## Risks / Trade-offs

- [Gallery selection and the move source clear each other] → the render test changes the photo id while a photo stays selected and no source is set, then changes the other spread's source only after the gallery boolean is already false
- [`''` is a real key, not "missing"] → unit tests assert `null`, `''`, and the frame id separately
- [A filtered subscribe that still allocates] → both getters return a boolean or a string

## Touch-set

- `src/editor/gallerySelection.ts`, `src/editor/frameSelection.ts`
- `src/editor/ConnectedSpreadView.tsx`
- `src/editor/frameSelection.test.ts`, `src/editor/ConnectedSpreadView.test.tsx`
- `docs/roadmap.md`: after the `drag-swap-unplace` item, one unchecked prep line, ticked at archive

No Stryker allow-list edit. Both selection modules are already in main's mutate lists.

## Tests

Public API: the two getters and their subscribe functions (notify on boolean or key change; do not notify when the photo id changes while selected, or when the source moves between frames on another spread; unsubscribe stops calls).

`ConnectedSpreadView` render count reuses `twoSpreadBook` and `mountSiblingPaint`. Profile both mounted spreads for the selected-photo case (extend the harness with a second `Profiler`). Apply `4-grid` to `s0` so the other spread has two frames. Changing the selected photo id does not increase either count. Changing the source frame on `s0` does not increase `s1`'s count. Setting a source, clearing it, and moving the source onto `s1` do. Assert the existing accessible names in that test. Reset gallery and frame selection in the existing `afterEach`.

No Playwright and no `ui-review`: labels and layout stay as they are, and this change adds no scrollport.

## Composition

Derived snapshots stay beside the stores they read. `ConnectedSpreadView` only subscribes and calls `frameControlLabel`. `render` stays free of editor stores.

## Migration Plan

None. Both stores are in-memory and reset with the existing reset functions.
