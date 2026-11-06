# static-export-closeout

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item static-export-closeout

## Scope

- [x] Verify every Scope bullet of `static-export` (P3) on main with test / e2e evidence; a gap keeps it open and is listed in the PR body
- [x] All met: `Status: done` in `docs/roadmap/P3/static-export.md` (`pnpm roadmap done`; item PRs leave `docs/roadmap.md` to the owner's `sync`)
- [x] Archive `openspec/changes/static-export`: its `site-export` and `library-storage` deltas synced into `openspec/specs/`, validation green
- **Done when:** `pnpm roadmap check` passes; `pnpm roadmap next` no longer returns `static-export`; `openspec/changes/static-export/` is gone and its requirements are in `openspec/specs/`; PR body has a Done-when → evidence table
- **Browser check:** N/A (roadmap / openspec docs only; no `src/`, `uikit/`, `e2e/` changes)
- **UI kit:** N/A
