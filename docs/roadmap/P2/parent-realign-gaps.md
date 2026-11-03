# parent-realign-gaps

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item parent-realign-gaps
Status: done

## Scope

- [ ] Deleting a parent (`removeParent`) re-aligns exactly the templated spreads whose resolved grid changes (stored id → None, default dropped → unset spreads to None); other spreads keep their objects; spread overrides keep their values
- [ ] Changing the book default parent re-aligns only the spreads with no stored parent whose resolved grid changes; no writer exists yet, so the core op `setDefaultParent` (BookOp, one undo step) carries it (the Book settings pill stays read-only)
- **Bug rule:** every caller of `removeParent`, every `defaultParentId` writer and any other op that changes a spread's resolved parent (incl. undo snapshot restore) is fixed or listed in the PR body with a reason
- **Done when:** unit tests in `grid.test.ts`: delete a gridded parent → its spreads re-align to the book grid (frame rects change), spreads on other parents stay identical objects; change the default parent → only unset spreads re-align; overriding fields keep their values. PR body: re-aligned spreads in a 40-spread book for both ops (before 0 → after N) and the caller table. Unit + typecheck green
- **Perf:** `parent-spreads-inspector` "40 spreads grid edit" not worse (re-align compares resolved grids, O(spreads))
- **Browser check:** N/A — no UI change; Masters Delete is covered through `applyBookOp`
- **Hard nos:** no edits in `uikit/`, `src/editor/EditorTopBar.tsx`, editor thumb/chrome files of #423, canvas/selection files of #421; stay in `src/core/` (+ minimal `bookStore.ts` wiring); no migrations
- **Source:** #418 PR body "known gaps", review `shared/reviews/418-64a22e25ee65.md:20`
