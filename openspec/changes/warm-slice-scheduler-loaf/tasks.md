## Implementation

- [x] 1. Memoize `cacheKeyFromIdentity` by identity string (bounded), with unit tests.
- [x] 2. Pure filmstrip selection rules (click, Shift range, Ctrl toggle, select all, keyboard focus moves) in `filmstripSelection.ts`, with unit tests.
- [x] 3. Grid focus store (`filmstripGridFocus.ts`): focused id, focus-visible flag, pending focus for unmounted rows.
- [x] 4. Filmstrip renders its own `role=grid` with memoized `role=row` items in place of `GridList` / `GridListItem`, with the same attributes, selection and keyboard behaviour.
- [ ] 5. Component tests for roles, click / Ctrl / Shift selection, arrows, Home / End, Ctrl+A, and a window shift that renders only the entering rows.

## Manual test scenarios

1. Reopen a 1000-photo book and fling the strip: thumbs fill, no stalls.
2. Click, Ctrl+click and Shift+click photos; drag a multi-selection onto a frame.
3. Focus the strip, use arrows / Home / End / Escape.
4. Perf: `thumb-warm-slice` and `thumb-bulk-hydrate` frame-budget gates, `--repeat-each=10 --retries=0`.
