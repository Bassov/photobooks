# filmstrip-resize-drop

Tag: feature
Milestone: M3
Title: filmstrip size and desktop drop

## Scope

- [ ] Adjustable filmstrip height / thumbnail size
- [ ] Desktop files dropped on the filmstrip are imported
- **Perf:** resizing the filmstrip resizes via `transform` / CSS variables during the drag and re-lays out the virtualizer at the end. Gate: resize the filmstrip while scrolled mid-gallery — zero LoAF.
- **Browser check:** resize the filmstrip and thumbnails; drop files from the desktop and they append; no gaps in the scrolled filmstrip.
- **UI ref:** `uikit#/feature/filmstrip-resize-drop`
- **UI kit:** `uikit/src/features/m3.tsx:256-265` (`filmstrip-resize-drop` demo + notes), `UI ref: uikit#/feature/filmstrip-resize-drop` — filmstrip height slider + desktop drop
