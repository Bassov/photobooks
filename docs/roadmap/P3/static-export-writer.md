# static-export-writer

Tag: feature
Milestone: P3
Title: Bug: /next-roadmap-item static-export-writer
Status: done

## Scope

- [x] `src/site/export/writeSiteTree.ts`: pure planner (current `dist/` listing + new tree → write / delete / refuse) and a thin `FileSystemDirectoryHandle` writer under `<folder>/dist/`; an existing `dist/` is replaced only when our manifest is at its root, else nothing is touched and a typed `not-our-export` error is returned; files not in the new tree are removed
- [x] `src/site/export/site-export.worker.ts`: module worker gets the dir handle and the frozen revisions, runs `buildSiteTree` and the writes, posts only `{phase, done, total}` at most once per 250 ms, then `{done: {books, files, bytes}}` or `{failed: {code}}` (permission, quota, not-our-export, unknown)
- **Done when:** planner unit tests (empty dir, our earlier export with stale files removed, foreign `dist/` refused with 0 writes); PBT ≥1000 runs (same tree twice → byte-identical dir; dir file set equals the tree file set; a foreign dir is never changed); a worker test shows progress messages ≥250 ms apart; no new dependencies
- **Browser check:** n/a (no UI; the e2e comes with `static-export`)
- **Hard nos:** no UI, no store, no `publishBook` call; no backward compatibility (Owner 2026-11-02)
- **Test:** unit + PBT + worker shell test; no e2e
- **Depends:** static-export-core
