## Proposal

Roadmap: [docs/roadmap/P1/design-r3-book-cover.md](../../../docs/roadmap/P1/design-r3-book-cover.md). UI ref: `uikit#/demo` steps 13, 24.

### Scope out

- How many spreads a new book starts with (create flow, not this touch-set).
- Editable spine width or page count.

### Delta / Risk

- Rendered `#/demo` wins over the brief's number field / stepper: Spine width is read-only text, Pages is pill + hint + note.
- e2e observables: new book → back text = title (field + canvas); edit updates canvas; Pages for 6 pages and after adding spreads.
