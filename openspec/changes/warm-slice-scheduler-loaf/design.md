## Decisions

1. Cause (roadmap Attribution): a major GC inside the React window task, fed by react-aria `GridListItem` re-rendering every mounted row on each window shift (`ListStateContext` changes with the collection). Slicing cannot help; removing the garbage does.
2. `cacheKeyFromIdentity` memoizes digests by identity string (bounded FIFO, 16 384). Key format and output unchanged.
3. The filmstrip renders its own `role=grid` with memoized `role=row` items (`.filmstrip-item`, same roles, name and selection / focus attributes as today). Each row subscribes to its own selected / focused boolean, so a window shift renders only entering rows.
4. Pure selection rules in `filmstripSelection.ts`, matching today's react-aria `replace` behaviour: click replaces, Ctrl/Meta toggles, Shift selects anchor→id in view order, Ctrl/Meta+A selects all; Arrow Left/Right, Home, End move focus and select, Shift extends, Ctrl/Meta only moves focus; Space selects the focused row, Ctrl/Meta+Space toggles it. Escape stays with the filmstrip section handler. PageUp / PageDown are not carried over.
5. `filmstripGridFocus.ts` is the filmstrip's own view state (focused id, focus-visible, pending focus). Home / End to an unmounted row scroll to its prefix offset; the row focuses itself on mount.
6. No visual change: existing `.filmstrip-item` classes and tokens stay; the row body (`FilmstripItemBody`, its `onDragStart` multi-drag) is unchanged.

## Touch-set & Test Plan

- Files: `src/assets/cacheKey.ts`, `src/editor/Filmstrip.tsx`, `src/editor/FilmstripItem.tsx`, `src/editor/filmstripSelection.ts`, new `src/editor/filmstripGridFocus.ts`. Temporary, not shipped: `e2e/zz-loaf-profile.spec.ts` (attribution, deleted before finish).
- Reuse: `gallerySelection` store, `buildStridePrefix` offsets, `installEditorKeys`.
- Tests: unit `cacheKey` memo; `filmstripSelection` rules; `Filmstrip.multiSelect` roles, click / Shift / Ctrl, arrows, Home / End, Ctrl+A, multi-drag, entering-rows-only render. e2e: filmstrip, multi-drop-fill, drag-swap; both frame-budget gates `--repeat-each=10`.
