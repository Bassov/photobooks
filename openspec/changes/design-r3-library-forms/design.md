## Decisions

1. Targets are computed styles measured on rendered `#/demo` (values live in the e2e spec).
2. Rename: prod renders the UA inset border + 1px padding because the class only uses Tailwind utilities on a non-preflight input. Move the look into `.pb-lib-rename` in `libraryScreenStyles.ts` (tokens `--field`, `--background`, `--ring`, `--radius-md`) so it does not depend on preflight.
3. Rename focus: the menu popover restores focus to the trigger, so prod never shows the ring and Enter / Escape need a click. Replace `autoFocus` with `focusRenameInput` (in `libraryRename.ts`, mutation-tested) that focuses after the frame the popover restores in.
4. Search: drop the `.pb-lib-quiet` focus outline (`libraryScreenStyles.ts`); hover tone unchanged. Kit source's `focus-within:outline-2` renders no ring because `outline-hidden` sets the outline style to none.
5. Width / Height: `Field.css` `[data-steppers='true']:focus-within` keeps the field-tone border instead of `--muted-foreground` (only `CreateBookDialog` uses `steppers`).
6. Accessibility: same as kit — caret plus field fill mark focus; no new tokens (docs/design.md unchanged).

## Touch-set & Test Plan

- Files: `src/editor/LibraryScreen.tsx`, `src/editor/libraryRename.ts(+test)`, `src/editor/libraryScreenStyles.ts(+test)`, `src/ui/Field.css`, `e2e/design-r3-library-forms.spec.ts` (new), `e2e/design-r2-library-settings.spec.ts` (old search outline → kit values).
- Reuse: existing tokens, `openLibraryWithBook` pattern.
- Tests: unit `focusRenameInput` (deferred focus, null ref); e2e rename computed styles + focused on open + Enter / Escape; search and Width / Height focus styles; empty state unaffected (search only renders with books).
