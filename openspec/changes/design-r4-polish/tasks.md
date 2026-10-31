## Implementation

- [x] 1. M38 hint pill: `isStatusPillVisible` + `data-pill` kit `StatusLine` CSS; filled frames always photo-drag, move gesture empty-frame only.
- [x] 2. M39 top-bar grid centred on the panel widths.
- [x] 3. M40/M41 shared Menu: `--leading-menu` rows, `circle` dot for single selection.
- [x] 4. M42 live-gap label hiding mid gesture; boundary unit tests; `docs/design.md` deviation line.
- [x] 5. e2e `design-r4-polish.spec.ts`; M20 specs moved to the canvas-centre rule.

## Manual test scenarios

1. 1440×900: drop a photo on a frame, click it, drag it over another frame then the filmstrip: pill bottom-left with the kit text; release on the filmstrip unplaces, pill gone.
2. Top bar: tool group centred over the canvas; close the inspector: group stays; widen the left panel: group follows.
3. Library: Sort menu rows ≈31 px (kit 30.84) with a dot on the current choice; book card menu rows 31 px; filmstrip sort menu the same.
4. Zoom to the floor: no page numbers; back to Fit: numbers 8 px under each page, 11 px.
