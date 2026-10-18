## Problem

Pipeline assumes one agent in the main checkout. Parallel M2.1 worktrees fail: no slug pick, preflight switches local `main`, claimed skips miss local/worktree branches, push-failure state breaks when `.git` is a file, `roadmap done` ticks the shared index (PR conflicts) and may auto-archive, lessons appends collide, git-finish stops on `main` conflicts instead of merging.

## Why now

Owner decision 2026-10-18 11:35: after this lands, M2.1 runs up to five parallel worktree agents.

## Scope in

Eight outcomes (≤8 tasks; owner wants all item checkboxes in this PR):

1. Slug pick + claim: `roadmap next --slug` (validate open/active; contingency only when asked), `--skip` unchanged; optional `claim` / claimed-set for preflight
2. Worktree preflight: `agent preflight --slug` branches from `origin/main` without local `main` switch/pull; without `--slug` keep main-checkout flow
3. Claimed set includes open PRs, remote `feat|fix/*`, local branches, and worktree checkouts so bare `next` never returns a held item
4. Worktree-safe git paths for push-failure state and other git-internal files
5. Done in item file; index tick after merge (`sync` / check tolerance); migrate existing dones; archive via `roadmap archive <M>` (warn, not fail, when fully done but active)
6. Conflict-free lessons entries + updated append rules
7. Auto-merge trivial conflicts with `main` (stop only on semantic ones); `/next-roadmap-item [<slug>]` wires slug to preflight
8. Per-worktree e2e/preview port + unit tests for every changed script path (tmp repo + real linked worktree)

## Capabilities

- **Modified:** `agent-context` — parallel worktree agents: slug/claim, preflight, done/archive, lessons layout, git-finish merge, e2e port

## Scope out

Product UI; CI threshold changes; `lessons-dissolve` removal; rebase workflows; >5 slots.

## Success criteria

- Linked-worktree `preflight --slug <s>` creates `feat/<s>` from `origin/main` while `main` is checked out elsewhere
- Bare `roadmap next` skips an item held only by another worktree’s local branch
- Two done-marking branches merge with no conflict on `docs/roadmap.md`; last two closes keep `roadmap check` green until `roadmap archive`
- New lesson is a separate file (no shared-journal append); `E2E_PORT` isolates preview per worktree; `/next-roadmap-item <slug>` reaches preflight with that slug
- Push-failure counter works in a linked worktree; trivial `main` conflicts auto-merge and re-push
- Script diff mutation ≥ 85, no NoCoverage; no-slug single-agent flow unchanged; existing dones stay done

## Risks

- Done migration must not reopen closed items
- Stale local branches may over-claim (skip open items)
- Trivial merge resolve must not hide semantic conflicts
