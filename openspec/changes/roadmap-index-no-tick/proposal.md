## Proposal

Roadmap: `docs/roadmap/P2/roadmap-index-no-tick.md` (scope / Done when; process item P-20261104-0150-1).

### Scope out

- No rig bump: rig `done` already writes only the item file, `next` reads `Status: done`, `check` only warns.
- No change to index order, priority, `add` / `move` / `archive`; no `src/` / `uikit/`.

### Delta / Risk

- Index ticks lag: `check` warns `sync:` until an Owner-side `sync` / `archive <M>` on `main`.
