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

`pnpm agent manual-qa`: blocked before any scenario (harness `start-session` click intercepted by the welcome header; welcome screen untouched here). Scripted browser check instead (Playwright, 1440×900, test-API library, values vs rendered `#/demo`):

- 1 OK: focus stays in `rename-input` after Rename; radius 8px, border 0, padding 8px, height 28px, fill `rgb(215,215,215)`, ring `0 0 0 2px rgb(225,225,225), 0 0 0 4px rgb(58,56,57)` = kit; Enter / Escape in e2e.
- 2 OK: `lib-search` focused: outline none, box-shadow none, fill `rgb(215,215,215)` = kit.
- 3 OK: Width / Height focused: outline none, box-shadow none, border `rgb(215,215,215)` (field tone), fill `rgb(215,215,215)` = kit.
