## M1 — Editor skeleton

**Review cut:** the core editing loop works at 60 fps — add your photos to the filmstrip, drag them onto spreads on a zoomable pasteboard and back. Validates the document model, the shared renderer (including its pan/zoom performance) and drop semantics. Nothing is persisted yet.

- [x] [prep] [frame-budget-gates](frame-budget-gates.md) — 60 fps measurement and gates (Security Review: headers)
- [x] [prep] [book-core-schema](book-core-schema.md) — pure book document in `src/core`
- [x] [prep] [layout-geometry](layout-geometry.md) — templates, resolver, ops
- [x] [feature] [editor-shell-filmstrip](editor-shell-filmstrip.md) — editor layout and gallery
- [x] [prep] [spread-view-painter](spread-view-painter.md) — shared DOM painter
- [x] [feature] [pasteboard-workspace](pasteboard-workspace.md) — spreads on a pasteboard
- [x] [feature] [spread-templates-ui](spread-templates-ui.md) — start a book
- [x] [feature] [camera-zoom-pan](camera-zoom-pan.md) — zoom and pan
- [x] [feature] [zoom-image-tiers](zoom-image-tiers.md) — sharp images at every zoom
- [x] [contingency] [far-zoom-lod](far-zoom-lod.md) — not needed (gate passed in `camera-zoom-pan`)
- [x] [feature] [drag-place-replace](drag-place-replace.md) — drop photos onto frames
- [x] [feature] [drag-swap-unplace](drag-swap-unplace.md) — rearrange and take back
- [x] [prep] [mutation-scope-guard](mutation-scope-guard.md) — mutate all of `src` by default; exclude only files that are pointless to mutate; diff run uses that scope; CI fails when a new production file is neither in scope nor excluded
- [x] [feature] [filmstrip-file-name](filmstrip-file-name.md) — filmstrip label uses `sessionMeta.name` (File.name), not the sanitized asset id
- [x] [feature] [template-unplace-notice](template-unplace-notice.md) — applying a smaller template still drops overflow placements, photos stay in the gallery, and a polite editor status says how many were unplaced (no status when zero)
- [x] [prep] [selection-render-scope](selection-render-scope.md) — ConnectedSpreadView subscribes to stable derived selection snapshots so other spreads do not re-render
- [x] [feature] [add-spread-camera](add-spread-camera.md) — Add spread keeps the committed zoom and reveals the new spread after layout, without jumping scrollHeight early
