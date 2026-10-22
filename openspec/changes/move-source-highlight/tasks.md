## Implementation

- [x] 1. Keep move-source / focus rings paintable: overflow clip on frame body, not the frame control that owns the outline. (`src/render/SpreadView.css`)
- [x] 2. Ensure pressed outline stays a clear screen-space ring (CSS px, `--select`) at low zoom. (layout zoom; 3px outline not clipped)
- [x] 3. Regression: Playwright — pressed `Cancel move` frame has visible outline (overflow not clipping) at stack-fit zoom. (`e2e/drag-swap.spec.ts`)

## Manual test scenarios

1. Place two photos; focus a filled frame; Enter → “Cancel move” with a clearly visible selection ring at ~13%, ~38%, and ~64% zoom.
2. Escape clears the ring; focus-visible ring still appears on keyboard focus.
3. Swap via another frame still works; no page-level scroll.

OK Place two photos; focus a filled frame; Enter → “Cancel move” with a clearly visible selection ring at ~13%, ~38%, and ~64% zoom.
OK Escape clears the ring; focus-visible ring still appears on keyboard focus.
OK Swap via another frame still works; no page-level scroll.
