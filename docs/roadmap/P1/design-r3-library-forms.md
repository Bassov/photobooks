# design-r3-library-forms

Tag: feature
Milestone: P1
Title: Bug: design-r3-library-forms: rename field pill, quiet focus rings

## Scope

- [ ] Step 43 library rename field = kit `Input` as rendered on `#/demo`: 28 px pill, 8 px radius, no border, 8 px padding, field fill, focused on open with the kit ring (`0 0 0 2px` background + `0 0 0 4px` ring). Enter commits, Escape cancels, as before.
- [ ] Steps 46 / 07 quiet focus: library search (`lib-search`) and Create-book Width / Height (`create-custom-w|h`) focus without outline, box-shadow or dark border; the field fill stays `#D7D7D7` (rendered `#/demo` values; the caret marks focus, as in the kit).
- **Done when:** e2e `design-r3-library-forms.spec.ts` (rename computed radius / border / padding / ring + Enter / Escape; search and Width / Height focus outline / box-shadow / background / border equal the `#/demo` values) passes with `--repeat-each=30`; existing specs that encoded the old rings are updated to the kit values.
- **Browser check:** library → book menu → Rename: rounded pill with ring, typing works at once; type in search: no dark ring; Create book → Custom size → focus Width / Height: no dark border.
- **Perf:** N/A (CSS + one deferred focus).
- **UI kit:** `uikit/src/demo-parts/library.tsx:53-54` (rename `Input`), `uikit/src/features/library.tsx:123-127` (`LibSearch`), `uikit/src/features/create-book.tsx:30-33` (custom size inputs); UI ref: `uikit#/demo` steps 07 / 43 / 46.
- **Source:** Designer round 3, 2026-10-31 (NOT PASS on prod 6300717).
