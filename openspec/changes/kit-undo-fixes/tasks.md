## Implementation

- [x] 1. `store.tsx`: current spread in `Hist`; entries carry `cur` / `next`; `update` 4th arg; undo/redo select them (`e2e/kit-undo-fixes.spec.ts` duplicate + delete cases)
- [x] 2. Spread ops pass their new current spread: Duplicate, Add after, Delete, Reorder (`chrome.tsx`), New spread from drop (`viewport.tsx`)
- [x] 3. `useKeys`: skip only text entry for Ctrl/⌘ combos; non-text inputs keep plain keys (`e2e/kit-undo-fixes.spec.ts` Switch + Text field cases)
- [x] 4. `e2e/kit-undo-fixes.spec.ts`: duplicate undo/redo selection + paint, delete undo, Switch focus undo, text-field guard

## Manual test scenarios

1. Kit `#/demo` editor: duplicate spread 3, Ctrl+Z → spread 3 highlighted, Shift+Ctrl+Z → copy highlighted.
2. Focus the Live caption Switch (Tab), Ctrl+Z → last op undone.
3. Ctrl+Z in the inspector Text field → doc history unchanged.

Agent manual-qa drives prod editor-shell only (no kit route), so the kit scenarios are covered by Playwright in the browser:

- OK 1: `e2e/kit-undo-fixes.spec.ts` "undo of Duplicate spread…" — p3 selected after Ctrl+Z, p4 after Shift+Ctrl+Z; row pixel `#CACACA` on p3, not on p4.
- OK 2: "Ctrl+Z with a focused Switch…" — Align back to Left, redo to Center.
- OK 3: "Ctrl+Z inside the Text field…" — Align stays Center, Redo disabled.
- OK kit `pnpm uikit:qa:quick`: 421 passed, 0 failed, no console errors.
