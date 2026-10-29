# look-parity-page-labels

Tag: feature
Milestone: M4
Title: look parity: canvas page labels and drop-target visuals
Status: done

## Scope

Look parity (Owner 2026-10-29: the editor must look exactly like the UI kit `uikit/` v0.9.3; no fake / disabled controls). This is a **visual-only look-parity subset** of the existing drop items ([`multi-drop-fill`](../M3/multi-drop-fill.md), [`filmstrip-resize-drop`](../M3/filmstrip-resize-drop.md) and the gallery drop): they own the behaviour and their boxes stay as they are; no new drop logic, targets or hit-testing here.

- [x] Page labels under every regular spread (`page-labels`, kit `PageLabels`): one centred label per page half, moving with zoom / pan, hidden in Presentation; numbering matches `pageLabel()`
- [x] Frame drop target while a photo is dragged: hovered overlay with the "Release to place" / "Release to replace" chip, dashed hint on the other eligible empty frames
- [x] "Drop here for a new spread" gap band restyled to the kit pill with a plus glyph (same element, attributes, show / hide and hit-testing)
- [ ] Spread (paper) drop outline (kit `outline-mark` dashed): omitted when the app has no spread-level drop target with `data-drop-hover` (no new target is added)

**Done when:** page numbers sit under each spread and follow zoom / pan; dragging a photo shows the hovered frame overlay with its chip, dashed hints on other empty frames and the kit pill in the gap; nothing appears in Presentation / render / PDF; no accent colour.
**Browser check:** drag an asset over the pasteboard: gap pill visible, hovered frame shows the chip; page labels show 1, 2-3, 4-5, … under the spreads.
**Perf:** CSS / static elements only; no per-frame React work; slot stride and zoom math unchanged; zero LoAF.

- **Kit components:** `PageLabels` and `GapDrop` (`uikit/src/sandbox/viewport.tsx` l.14-20, 225, 241-263), `FrameEl` drop states (`uikit/src/sandbox/canvas.tsx` l.97-127, 385-396).
- **Demo:** `uikit/src/sandbox/*` (viewport / canvas)
- **Musts:**
  - Page labels under every regular spread; frame drop hovered overlay + chip text + idle dashed hint; gap pill; spread outline only if a real target exists.
  - Grayscale tokens only.
- **Hard nos:** no fake or disabled controls; no new drop logic, targets, hit-testing or features; no cover / endpaper / last-page / master labels; no new accent colours; no changes to slot stride or zoom math; no labels / overlays in preview / PDF; no rulers or inspector changes.
- **Tokens:** `--muted-foreground`, `--select`, `--field`, `--foreground`, `--text-2xs`; label colour `#535152` maps to the existing muted token.
- **Test:** unit — page-label text mapping (first spread `["", "1"]`, then `[2si, 2si+1]`), hidden in preview, chip text place / replace, gap pill state; e2e — asset drag shows the gap pill and the chip on the hovered frame, `page-labels` numbers under the spreads.
- **Depends:** look-parity-rulers, multi-drop-fill, filmstrip-resize-drop
