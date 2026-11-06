## Proposal

Roadmap: `docs/roadmap/P3/static-export-closeout.md` (scope / Done when SoT).

### Scope out

- Any `src/`, `uikit/`, `e2e/` change (docs / openspec only).
- Other items' roadmap lines and the `docs/roadmap.md` index (owner `sync` on main).

### Delta / Risk

- No new behavior: `static-export`'s two ADDED requirements (`Export site from the editor`, `Published revision storage`) are copied verbatim into `openspec/specs/` before `pnpm agent archive static-export`, so nothing is dropped unsynced.
