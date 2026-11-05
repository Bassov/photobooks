## Decisions

1. **History state holds the current spread.** `setCur` and undo/redo go through the same history updater, so doc and current spread change in one atomic step (no effect lag, no stale ref on fast repeats).
2. **Spread ops record before and after.** An optional `update` argument names the spread to select after the op; undo selects the one before, redo the one after. Ops without it leave the current spread alone. Callers: Duplicate, Add after, Delete, Reorder (`chrome.tsx`), New spread from drop (`viewport.tsx`); canvas `setCur` calls are selection only and stay.
3. **Key guard.** `useKeys` skips text entry only (text-like `input`, `textarea`, contenteditable). Other inputs (switch, radio, range) keep plain keys for themselves but pass Ctrl/⌘ combos.
4. Kit-only behaviour, no new tokens or primitives; `ui-review` on the spread list highlight.

## Touch-set & Test Plan

| File                                | Why                                        |
| ----------------------------------- | ------------------------------------------ |
| `uikit/src/sandbox/store.tsx`       | history cur, entry before/after, key guard |
| `uikit/src/sandbox/chrome.tsx`      | spread ops pass cur                        |
| `uikit/src/sandbox/viewport.tsx`    | drop op passes cur                         |
| `e2e/kit-undo-fixes.spec.ts`        | new kit e2e                                |
| `docs/roadmap/P3/kit-undo-fixes.md` | item scope (stub filled)                   |

- Reuse: `e2e/fixtures/paintProbe.ts` `pixelsAt`; setup of `e2e/kit-frame-keys.spec.ts`.
- e2e: Done-when cases plus Delete undo.
