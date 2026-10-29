# filmstrip-resize-drop

Tag: feature
Milestone: M3
Title: filmstrip size and desktop drop
Status: done

## Scope

- [ ] Adjustable filmstrip height / thumbnail size
- [ ] Desktop files dropped on the filmstrip are imported
- **Perf:** resizing the filmstrip resizes via `transform` / CSS variables during the drag and re-lays out the virtualizer at the end. Gate: resize the filmstrip while scrolled mid-gallery — zero LoAF.
- **Browser check:** resize the filmstrip and thumbnails; drop files from the desktop and they append; no gaps in the scrolled filmstrip.
- **UI ref:** `kit v0.9.3 #/feature/filmstrip-resize-drop (removed in kit v0.10.0, no replacement)`
- **UI kit:** none in v0.10.0 (kit v0.9.3 `#/feature/filmstrip-resize-drop (removed in kit v0.10.0)`, removed) — filmstrip height slider + desktop drop
