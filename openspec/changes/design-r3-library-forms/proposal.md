## Proposal

Roadmap: `docs/roadmap/P1/design-r3-library-forms.md` (scope / Done when / Browser / Perf SoT). UI ref: `uikit#/demo` steps 07 / 43 / 46.

### Scope out

- Editor canvas, top bar, filmstrip and cover files.
- Width / Height stepper look (focus style only).
- Other `NumberField` / `TextField` focus rings.

### Delta / Risk

- Rendered `#/demo` wins over kit source. e2e locks happy (rename pill + ring, Enter / Escape), interact (search, Width / Height focus) and empty (no books: no search, nothing to rename).
