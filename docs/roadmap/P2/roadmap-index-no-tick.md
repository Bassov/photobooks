# roadmap-index-no-tick

Tag: feature
Milestone: P2
Title: Bug: /next-roadmap-item roadmap-index-no-tick
Status: done

Process item P-20261104-0150-1. Item PRs stop editing the shared index `docs/roadmap.md`: adjacent tick lines conflict in git, so every merge made every other open PR DIRTY (orch JOURNAL: most DIRTY rounds were a `docs/roadmap.md` line only).

## Scope

- [x] Done state lives only in the item file (`Status: done`); `pnpm roadmap next` / `check` derive it from there on read. Photobooks-side change (the rig already reads `Status: done` and `check` only warns on a pending tick), no `@albasov/ts-agent-rig` bump.
- [x] `pnpm roadmap done <slug>` changes only the item file; `operations.archive` in `openspec/config.yaml` drops the `sync` step for item PRs.
- [x] `docs/roadmap/RULES.md`: the item PR writes `Status: done` in its item file only; the adjacent-tick conflict recipe is deleted; RULES.md net shorter. Skill `roadmap` and `docs/agent-loop.md` lose the per-PR `sync` too.
- [x] One-time migration of the current index in this PR: `pnpm roadmap sync` ticks the file-done lines (incl. `locked-frame-swap`, merged #427 but unticked). This PR is the last item PR that touches the index.
- **Hard nos:** no change to index order or priority semantics; `add` / `move` / `archive` still edit the index (Owner / orchestrator only).
- **Browser check:** N/A (process / docs; no UI).

## Done when

- A CLI test runs `roadmap done <slug>` on a fixture and asserts only the item file changed.
- The same test shows `roadmap next` skips a done item whose index line is untouched, and `check` stays green (warning only).
- `pnpm roadmap check` green after migration; RULES.md net shorter; typecheck + unit green.
