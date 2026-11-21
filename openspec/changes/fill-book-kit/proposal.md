## Proposal

Roadmap: `docs/roadmap/P5/fill-book-kit.md`. Design SoT: Designer Spec fill-book FB1. UI ref: `uikit#/demo`.

### Scope out

- Prod chip / popover / confirm flow (FB3); core op merged (FB2).
- `e2e/kit10-filmstrip.spec.ts` pin: it tests the prod editor, so it moves to FB3 (item text says so).

### Delta / Risk

- e2e locks empty (chip disabled), happy (rows, Enter, status, one Ctrl+Z) and interact (Esc, Masters, limit) cases.
