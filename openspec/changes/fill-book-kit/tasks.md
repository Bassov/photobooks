## Implementation

- [x] 1. Kit `planFillBook` / `fillBook` in `uikit/src/sandbox/store.tsx` (rules F3–F9, kit mapping per design Decision 1).
      Evidence: 3a502173; e2e `fill-book FB1` tests (numbers, limit, missing).
- [x] 2. `FillBook` chip + popover in `uikit/src/sandbox/chrome.tsx` `FilmChips` (disabled reasons, rows, notes, Enter / Esc,
      status, active spread). Evidence: 3a502173; `e2e/kit-filmstrip.spec.ts` fill-book + KS13 pins.
- [x] 3. `uikit/scripts/demo-capture.mjs`: `editor-fill-book-open` / `-done` / `-undone`; re-baseline into `.cache/agent`.
      Evidence: 102 steps captured, shots 21–23, no page errors.
- [x] 4. `e2e/kit-filmstrip.spec.ts`: head order + SPEC row; fill flow, Esc, Masters, empty, limit and missing cases.
      Evidence: `pnpm test:e2e:quiet e2e/kit-` 414 passed.

## Manual test scenarios

1. Kit `#/demo` new book → Add folder → Fill book chip → popover numbers → Enter → status + filled spreads → Ctrl+Z.
   OK (harness: agent manual-qa cannot drive the kit demo): the same walk is the e2e `fill-book FB1` test plus the
   demo-capture steps 21–23 (open shot checked: chip first, popover 296 above it, 18 photos into empty frames, 20 pages).
