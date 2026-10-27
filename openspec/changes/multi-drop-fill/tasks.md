## Implementation

- [ ] 1. Core ops fill + insert-spread-with-assets with unit + PBT tests
- [ ] 2. Wire ops into `BookOp`, history (one step each), core exports
- [ ] 3. Multi-selection store + Filmstrip GridList multiple / Ctrl+A / Esc
- [ ] 4. Multi-asset drag payload from `FilmstripItem`
- [ ] 5. Drop index gaps + `hitTestGap`; drop dispatch in `galleryDrop`; leftover status
- [ ] 6. Between-spread drop zone visuals in Pasteboard
- [ ] 7. e2e `multi-drop-fill.spec.ts` + perf scenario

## Manual test scenarios

1. Select four photos, drop on a 4-grid spread: all frames fill in order.
2. Drop two portraits between spreads: a new 2-portrait spread appears; Undo removes it in one step.
3. Drop 5 photos on a 4-grid: one stays unplaced, status says 1 left.
4. Shift+click photos 1→4, Ctrl+click 2 off, Esc clears all.
