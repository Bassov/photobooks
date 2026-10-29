# inspector-frame-sections

Tag: feature
Milestone: M4
Title: look parity: inspector Frame tab sections (Geometry / Arrange / Align / Delete)
Status: done

## Scope

Look parity, Phase B #2 (Owner 2026-10-29: the editor must look exactly like the UI kit; no fake or disabled controls — omit what has no real data). The visual subset of [`inspector`](inspector.md) (numeric properties) and [`arrange-lock`](arrange-lock.md) (stacking and locking), which stay open as the full features (context menu, shortcuts, multi-frame editing).

- [x] Frame tab order: Photo rows → Geometry → Fit & crop (existing) → Arrange → Delete; nothing selected → spread properties + "Select a frame to edit it." (kit `EmptyInspector`, unchanged)
- [x] Geometry ("Position & size"): X / Y / W / H mm fields (W / H min 5) on `moveFrame` / `resizeFrame`, rotation slider (variant B) + degree field on `rotateFrame`; lock toggle in the section header; fields and slider disabled when the frame is locked
- [x] Arrange: send to back / backward / forward / bring to front + muted "layer N of M"; new pure `reorderFrame` (renumbers `z` 1..n, detaches the template) and `layerOf` in `src/core/ops/arrange.ts`
- [x] Lock: pure `setFrameLocked` op (the model already has `Frame.locked`; transform ops already skip locked frames)
- [x] Delete: ghost button with the trash icon and a "Del" hint; `removeFrames` (placement dropped, spread leaves its template)
- [x] Icons `unlock`, `bringToFront`, `sendToBack`, `arrowUp`, `arrowDown` added to the in-repo set
- Align is not rendered: it needs 2+ selected frames and the editor holds a single selection (`multi-select` is a separate item).

**Done when:** selecting a frame shows the kit Geometry / Arrange / Delete sections in the Frame tab; no blue, no black chrome, no fake controls.
**Browser check:** select a frame → type W → it resizes; Arrange "front" → "layer N of M" updates; Lock disables the fields; Delete removes the frame; Ctrl+Z undoes each.
**Perf:** sections subscribe to the book snapshot only; the rotation slider coalesces a drag into one undo step (`rotateFrame` `live`).

- **Kit components:** `GeometrySection`, `ArrangeSection`, `AlignSection` (omitted), `DeleteFrameButton`, `MmField`, `EmptyInspector`, `InspectorPanel` (`uikit/src/sandbox/inspector.tsx`); `Section` (`components/app/ui`).
- **Demo:** `inspector`, `arrange-lock` → `uikit/src/features/m4.tsx`
- **Musts:**
  - Frame tab order Photo → Geometry → Crop → Arrange → Delete.
  - Align only with 2+ selected; multi-select is held → Align is not rendered.
  - Geometry: X / Y / W / H `MmField`s (W / H min 5), rotation slider variant B + degree field; disabled when locked.
  - Arrange: front / back / step buttons + "layer N of M" muted text; lock toggle because the model has `locked`.
  - Delete: ghost button with Trash + "Del" hint; clears the template binding.
  - Nothing selected → Spread-properties empty state.
- **Hard nos:** no fake / disabled / placeholder sections; no blue; black only on the canvas selection; no floating FrameToolbar; no new colours; no fit-crop or grid behaviour change; no Photo-rotate / Adjust / Caption sections; no canvas / rulers / topbar change.
- **Tokens:** fields `--field`; sliders variant B (shared `fit-crop-*` rules); muted text `--muted-foreground`.
- **Test:** unit — section order and visibility (none / frame / empty frame / locked / crop mode), W / H min 5, z-order and lock ops, `rotateFrame` coalescing; e2e — type W resizes, Arrange front updates the layer label, Delete removes the frame.
- **Depends:** look-parity-inspector-tabs, frame-transform-ops, frame-geometry-schema, free-frames

## Done note

Frame tab Geometry / Arrange / Delete sections
