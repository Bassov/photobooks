## Implementation

- [ ] 1. Kit `planFillBook` / `fillBook` in `uikit/src/sandbox/store.tsx` (rules F3–F9, kit mapping per design Decision 1).
- [ ] 2. `FillBook` chip + popover in `uikit/src/sandbox/chrome.tsx` `FilmChips` (disabled reasons, rows, notes, Enter / Esc,
      status, active spread).
- [ ] 3. `uikit/scripts/demo-capture.mjs`: `editor-fill-book-open` / `-done` / `-undone`; re-baseline into `.cache/agent`.
- [ ] 4. `e2e/kit-filmstrip.spec.ts`: head order + SPEC row; fill flow, Esc, Masters, empty, limit and missing cases.

## Manual test scenarios

1. Kit `#/demo` new book → Add folder → Fill book chip → popover numbers → Enter → status + filled spreads → Ctrl+Z.
