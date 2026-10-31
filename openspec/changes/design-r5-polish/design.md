## Decisions

1. M43 is fixed in CSS. The source photo's rect and crop never change. The selection ring and crop outline `::after` (inset 0, higher specificity) overrode the drop chip and painted a frame-wide grey block over the photo. Now both yield `::after` while `data-drop-hover` is set (`:not([data-drop-hover='true'])`), as the hover outline already does, and the `::before` `--select` outline marks the frame. The source stays its own drop target (kit step 17).
2. The chip line height becomes the kit `--text-2xs--line-height`.
3. M44: `pl-1.5 pr-2.5 gap-1` sit in the utilities layer and lose to `.pb-button--sm`. A scoped `.editor-library-link` rule sets the kit padding and gap from `--spacing`.

## Touch-set & Test Plan

- Files: `src/render/SpreadView.css`, `src/editor/EditorShell.css`, `src/editor/EditorTopBar.tsx`, `src/render/spreadChromeStyles.test.ts`, `e2e/design-r5-polish.spec.ts`, `docs/roadmap/P1/design-r5-polish.md`.
- Reuse: tokens `--spacing`, `--text-2xs--line-height`, `--select` and `--field`; the `data-drop-hover` and `data-drag-source` attributes.
- Tests:
  - e2e M43: the kit walk with the button held. Photo rect, style and transform are unchanged; opacity, handles, tint and chip match the kit values in the spec header. Everything is restored after Escape + up and after a self-drop.
  - e2e M44: the Library button, chevron and label are at the kit x.
  - Unit: the style test locks the selector.
