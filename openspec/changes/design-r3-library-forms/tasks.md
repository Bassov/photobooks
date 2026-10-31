## Implementation

- [x] 1. Rename field: `.pb-lib-rename` kit pill CSS (radius, no border, padding, fill, ring on focus) in `libraryScreenStyles.ts`. Evidence: `libraryScreenStyles.test.ts`, e2e `design-r3-library-forms.spec.ts` step 43.
- [x] 2. Rename focus: `focusRenameInput` in `libraryRename.ts` replaces `autoFocus`; unit test. Evidence: `libraryRename.test.ts`, e2e `toBeFocused` after Rename.
- [x] 3. Search: remove the `.pb-lib-quiet` focus outline. Evidence: e2e step 46.
- [x] 4. Width / Height: stepper field focus keeps the field-tone border (`Field.css`). Evidence: e2e step 07.
- [x] 5. e2e `design-r3-library-forms.spec.ts` (rename + Enter / Escape, search focus, Width / Height focus = `#/demo` values); update `design-r2-library-settings.spec.ts` search focus to the kit values. Evidence: both specs 240/240 with `--repeat-each=30`.

## Manual test scenarios

1. Library → book menu → Rename: rounded pill with ring, typing works without a click; Enter saves, Escape cancels.
2. Type in library search: no dark ring, fill stays `#D7D7D7`.
3. Create book → Custom size → focus Width, then Height: no dark border.
