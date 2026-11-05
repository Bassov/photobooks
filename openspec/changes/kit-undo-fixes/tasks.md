## Implementation

- [x] 1. `store.tsx`: current spread in `Hist`; entries carry `cur` / `next`; `update` 4th arg; undo/redo select them (`e2e/kit-undo-fixes.spec.ts` duplicate + delete cases)
- [x] 2. Spread ops pass their new current spread: Duplicate, Add after, Delete, Reorder (`chrome.tsx`), New spread from drop (`viewport.tsx`)
- [x] 3. `useKeys`: skip only text entry for Ctrl/⌘ combos; non-text inputs keep plain keys (`e2e/kit-undo-fixes.spec.ts` Switch + Text field cases)
- [x] 4. `e2e/kit-undo-fixes.spec.ts`: duplicate undo/redo selection + paint, delete undo, Switch focus undo, text-field guard

## Manual test scenarios

1. Kit `#/demo` editor: duplicate spread 3, Ctrl+Z → spread 3 highlighted, Shift+Ctrl+Z → copy highlighted.
2. Focus the Live caption Switch (Tab), Ctrl+Z → last op undone.
3. Ctrl+Z in the inspector Text field → doc history unchanged.
