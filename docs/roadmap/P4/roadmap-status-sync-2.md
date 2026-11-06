# roadmap-status-sync-2

Tag: feature
Milestone: P4
Title: Bug: /next-roadmap-item roadmap-status-sync-2
Status: done

## Scope

- [x] Audit `parent-overrides` (P2) and `static-export` (P3) against main: every unticked Scope bullet gets file:line / test / PR evidence or is listed as a GAP in the PR body; a fully evidenced item gets its bullets ticked and `Status: done`; an item with a gap stays open (no product code here)
- **Done when:** both item files are `Status: done` with every bullet ticked, or stay open with the gaps listed in the PR body; `pnpm roadmap check` passes; `pnpm roadmap next` returns no fully done item
- **Browser check:** N/A (roadmap docs only)
- **UI kit:** N/A
