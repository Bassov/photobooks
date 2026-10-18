# Design

## Context

See proposal.md. `scripts/roadmap.mjs` uses index `[x]` as done and auto-archives on last `done`; `scripts/agent.mjs` preflight switches/pulls local `main` and writes push failures under `<root>/.git/`. Linked worktrees and parallel item PRs break that model.

## Goals / Non-Goals

**Goals:** Enable ≤5 parallel worktree agents; keep no-slug main-checkout flow; remove shared-line conflicts for done/lessons/finish.

**Non-Goals:** Product UI; `lessons-dissolve`; CI threshold edits; rebase finish.

## Decisions

1. **Done SoT = item-file `Status: done`**  
   `cmdDone` sets header Status only (no index tick). `itemIsDone` = Status done OR legacy index `[x]`. `cmdSync` ticks index for file-done items (post-merge on main). `next`/`list` use `itemIsDone`.

2. **Archive = `cmdArchive(msId)` only**  
   Remove auto-archive from `cmdDone`. Fully-done-but-active → `cmdCheck` warning (exit 0). Update roadmap skill: no “review cut from done”; archive is explicit.

3. **Claimed set**  
   Extend `collectSkipSlugs` with local `feat|fix/*` and `git worktree list --porcelain`. `next --slug` validates; `claim` validates/prints for preflight. Preflight `--slug`: fetch + `switch -c --no-track origin/main` (or reuse branch); no local `main` switch/pull.

4. **Git paths** — `pushFailPath` via `git rev-parse --git-path`. Test with real linked worktree (`.git` file).

5. **Lessons** — Each existing bullet → `docs/lessons/NN-<kebab-from-first-words>.md` (01…N, first 4–6 words kebabized; collisions append `-2`). `docs/lessons.md` becomes a link index. Mandates/AGENTS → `docs/lessons/`.

6. **Finish merge in `cmdFinish`** — After a rejected push (non-FF / remote reports need pull) or when `git merge-base --is-ancestor origin/main HEAD` is false before push: `git fetch && git merge origin/main`. Auto-resolve only allowlisted shapes (adjacent roadmap/doc both-added → union; lockfile → `pnpm install`). Then `verify:fast:quiet` + push. Never rebase/force. git-finish.mdc mirrors this; CLI owns the behavior.

7. **E2E_PORT** — `const port = process.env.E2E_PORT || '4173'`. Playwright `baseURL`/`webServer` use it. Set `reuseExistingServer: false` always so a sibling worktree’s server is never reused.

## Touch-set

| File                                           | Reason                                                |
| ---------------------------------------------- | ----------------------------------------------------- |
| `scripts/roadmap.mjs`                          | slug/claim/done/sync/archive/check/next               |
| `scripts/roadmap.test.mjs`                     | tests + migration                                     |
| `scripts/agent.mjs`                            | preflight --slug, claimed set, git-path, finish merge |
| `scripts/agent.test.mjs`                       | worktree + git-dir + merge tests                      |
| `.cursor/commands/next-roadmap-item.md`        | optional slug                                         |
| `.cursor/rules/git-finish.mdc`                 | merge-on-conflict                                     |
| `.cursor/skills/roadmap/SKILL.md`              | done ≠ archive; `archive` / `sync`                    |
| `openspec/config.yaml`                         | lessons path                                          |
| `AGENTS.md`                                    | lessons nav                                           |
| `docs/lessons.md`, `docs/lessons/*.md`         | per-entry migration                                   |
| `docs/roadmap/M2.1/*.md`                       | `Status: done` on current index-`[x]` items (9 files) |
| `docs/roadmap/RULES.md`                        | done/archive/sync                                     |
| `playwright.config.ts`                         | E2E_PORT; no reuse                                    |
| `package.json`                                 | preview port wiring if needed                         |
| `openspec/specs/agent-context/spec.md`         | delta sync                                            |
| `docs/roadmap/M2.1/roadmap-parallel-agents.md` | ticks                                                 |

No gate threshold/exclusion edits.

## Tests / public API

Exercise `cmdNext`/`cmdDone`/`cmdCheck`/`cmdArchive`/`cmdSync`/`collectSkipSlugs`/`cmdPreflight`/`cmdFinish`/`pushFailPath`. Reuse tmp-repo fixtures; add `git worktree add` helper for linked-worktree cases.

## Risks / Trade-offs

- [Stale local feat/* over-claims] → prune docs; skip is advisory
- [Status/index drift] → check warns; sync on main
- [Merge mis-resolve] → allowlist only; else stop

## Migration Plan

Apply commit: write `Status: done` into the nine active M2.1 `[x]` item files; split lessons bullets into numbered files; index stays `[x]` (legacy OR) until `sync` on main. Rollback = revert PR.
