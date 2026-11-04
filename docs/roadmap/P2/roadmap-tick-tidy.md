# roadmap-tick-tidy

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item roadmap-tick-tidy
Status: open

Process item (Owner brief 2026-11-04). After #435 item PRs no longer tick the shared index `docs/roadmap.md`, so lines drift from their item files: `worker-ctx-trim` (merged #397) and `roadmap-index-no-tick` (merged #435) still show `[ ]`.

## Scope

- [x] One-time sync of the index from item files: check every `[ ]` line against its item file and `origin/main` history; close done items in their item file (`pnpm roadmap done`) and tick the index with `pnpm roadmap sync`.
- [x] Items superseded by text-frames (`text-blocks`, `live-captions`) are listed in the PR body only if their item file says so; no item is deleted (Owner audit).
- [x] `pnpm roadmap check` flags "item file done, index unticked"; if it already does, the PR says so, otherwise add the cheapest check or say why not.
- Off limits: `src/`, `uikit/`, items held by live workers (`text-frames-*`, `parent-guides`, `site-awards-demos`).
- **Done when:** `pnpm roadmap check` green; every index line matches its item file status; PR body lists each changed line.
- **Browser check:** N/A (docs only; no product code).
