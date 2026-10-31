## Proposal

Roadmap: [docs/roadmap/P1/design-r3-book-cover.md](../../../docs/roadmap/P1/design-r3-book-cover.md). UI ref: `uikit#/demo` steps 13, 24.

### Scope out

- How many spreads a new book starts with (create flow, not this touch-set).
- Editable spine width (designer ruling: read-only "N mm" is right).
- Dropping `cover.style.spineWidthMm` from the schema (needs a version bump; it is ignored instead).

### Delta / Risk

- Round 1 (PR #346): back text = title; Spine width read-only text; Pages read-only pill.
- Designer ruling (RESUME 1): spine width must be computed from the page count, and Pages must be an editable box (20–120, step 2) wired to the spreads.
- Risk: lowering Pages removes the last spreads (with their photos); one undo step restores them.
- e2e observables: new book → back text = title (field + canvas); typed Pages clamp / round / persist; spine text and canvas spine follow the page count.
