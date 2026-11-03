## Proposal

Roadmap: `docs/roadmap/P2/parent-realign-gaps.md` (scope / Done when / Perf SoT).

### Scope out

- UI for picking the book default parent (Book settings keeps its read-only pill; lane boundary).
- Rewriting stored `parentId` on a default change.

### Delta / Risk

- No default-parent writer exists yet: a new core op `setDefaultParent` carries the re-align, so the fix is in place when the UI lands.
