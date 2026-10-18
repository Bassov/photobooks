## ADDED Requirements

### Requirement: Roadmap slug selection and claim

`pnpm roadmap next` SHALL accept optional `--slug <s>` that returns that item when it exists, is open, and belongs to an active milestone. Unknown or already-done slugs MUST fail with a clear message. Contingency items MUST be refused unless contingency selection is requested. `--skip` SHALL keep working. Optional `pnpm roadmap claim <s>` (or an equivalent claimed-set helper used by preflight) SHALL record that the slug is held for skip purposes.

#### Scenario: Explicit open slug

- **WHEN** an agent runs `pnpm roadmap next --slug <open-active-slug>`
- **THEN** the CLI prints the same item view as bare `next` for that slug

#### Scenario: Unknown or done slug fails

- **WHEN** an agent runs `pnpm roadmap next --slug <unknown-or-done>`
- **THEN** the CLI exits non-zero with a message that names the problem

#### Scenario: Contingency refused by default

- **WHEN** an agent runs `pnpm roadmap next --slug <contingency-slug>` without requesting contingency
- **THEN** the CLI exits non-zero and does not select the item

### Requirement: Parallel worktree agent preflight

`pnpm agent preflight --slug <s>` SHALL work in the main checkout and in a linked worktree. It MUST fetch and create or reuse `feat|fix/<slug>` from `origin/main` without switching or pulling local `main`. Reuse of an existing local branch is allowed only when that branch is already the current branch of this checkout, or it exists locally, shares history with `origin/main` (`git merge-base` succeeds), and is not checked out in another worktree; otherwise preflight MUST fail with a clear message and MUST NOT reset or delete the branch. The clean-tree check SHALL remain. Without `--slug`, preflight SHALL keep the existing main-checkout sync behaviour.

#### Scenario: Linked worktree with main elsewhere

- **WHEN** `main` is checked out in the primary worktree and an agent runs `pnpm agent preflight --slug <s>` in a linked worktree with a clean tree
- **THEN** the command creates or reuses `feat/<s>` (or `fix/<s>`) based on `origin/main` and reports item `<s>`

#### Scenario: Current-branch reuse without switch

- **WHEN** `feat/<s>` is already the current branch of this checkout and create from `origin/main` fails because the branch exists
- **THEN** preflight reuses it without switching or resetting

#### Scenario: Branch held in another worktree refused

- **WHEN** `feat/<s>` exists locally but is checked out in another worktree
- **THEN** preflight exits non-zero with a message naming the other worktree and does not reset or delete the branch

#### Scenario: No-slug main checkout unchanged

- **WHEN** an agent runs `pnpm agent preflight` without `--slug` in the main checkout
- **THEN** it still syncs local `main` and picks the next unclaimed open item as before

### Requirement: Claimed set includes local and worktree branches

The skip/claimed set used by bare `roadmap next` and preflight SHALL include open PR head slugs, remote `feat|fix/*` slugs, local `feat|fix/*` branches, and branches checked out in any worktree (`git worktree list`). Bare `next` MUST NOT return an item another session already holds.

#### Scenario: Local worktree branch skips next

- **WHEN** another worktree has a local `feat/<slug>` checked out and no open PR exists for that slug
- **THEN** bare `pnpm roadmap next` (with the claimed set applied) skips that slug

### Requirement: Worktree-safe git-internal paths

Agent and roadmap tooling that stores state under git internals SHALL resolve paths with `git rev-parse --git-dir` or `--git-path`, never by joining the repo root with `.git`. This MUST work when `.git` is a file (linked worktree).

#### Scenario: Push-failure counter in linked worktree

- **WHEN** finish records a push failure from a linked worktree
- **THEN** the counter file is written under the resolved git directory and is readable on the next finish attempt in that worktree

### Requirement: Item-file done state and index sync

Roadmap done state SHALL be recorded in the item file (status metadata). Item PRs MUST NOT tick the shared index checkbox. `pnpm roadmap done` SHALL mark the item file done without editing `docs/roadmap.md` for the tick. `pnpm roadmap sync` (or equivalent) SHALL apply index ticks from item-file done state after merge. `list` / `next` / `check` SHALL treat item-file done as the source of truth for openness. Migration MUST keep previously index-ticked items done.

#### Scenario: Parallel dones do not conflict on index

- **WHEN** two branches each mark a different item done via `roadmap done`
- **THEN** neither branch edits the same `docs/roadmap.md` checkbox line, and the branches merge without an index conflict from those dones

#### Scenario: Check accepts pending index tick

- **WHEN** an item file is done and the index line is still unticked
- **THEN** `pnpm roadmap check` accepts that state (or syncs the tick) and does not fail solely for the pending tick

#### Scenario: Migration keeps existing dones

- **WHEN** migration runs on a tree whose index already has `[x]` items
- **THEN** those items remain done under the item-file source of truth

### Requirement: Separate milestone archive step

Milestone archiving SHALL be a post-merge operator step (`pnpm roadmap archive <M>` when every item is done on `main`), not a side effect of `roadmap done`. While a milestone is fully done but still active, `pnpm roadmap check` SHALL warn and MUST NOT fail solely for that reason.

#### Scenario: Last two items close in parallel

- **WHEN** two parallel PRs each close one of the last two open items of a milestone
- **THEN** `roadmap check` stays green (warn allowed) until `roadmap archive <M>` runs

#### Scenario: Done does not archive

- **WHEN** an agent runs `pnpm roadmap done` on the last open item of a milestone
- **THEN** the milestone folder remains active and archive is not performed

### Requirement: Conflict-free lessons entries

Repeated-finding lessons SHALL be stored as separate files under `docs/lessons/` (or an equivalent conflict-free scheme). Mandates that previously required appending to `docs/lessons.md` SHALL require adding a per-entry file instead. New entries SHALL use collision-free names `docs/lessons/<YYYY-MM-DD>-<slug>.md`; agents MUST read all entries in one call (not one Read per file); the index `docs/lessons.md` NEED NOT be updated per entry. Navigation MAY keep an index pointer.

#### Scenario: Two agents add lessons without conflict

- **WHEN** two parallel branches each add a new lesson entry
- **THEN** they do not both append to the same shared journal line and can merge without a lessons-append conflict

### Requirement: Auto-merge trivial main conflicts on finish

When a feature PR conflicts with `main`, git-finish / `pnpm agent finish` SHALL fetch and merge `origin/main`. It MAY auto-resolve only (1) `docs/roadmap.md` hunks where both sides purely ADD distinct whole lines relative to the merge base (parallel `roadmap add`), keeping both added lines, and (2) `pnpm-lock.yaml` via `pnpm install` when `package.json` itself has no conflict. After an auto-resolution it MUST run `pnpm -s roadmap check` before committing the merge; a failed check is treated as a semantic conflict. Any other conflict (item files, lessons, RULES/INTRO, modified or deleted base lines, `package.json`) MUST leave the merge in progress (or abort it), MUST NOT commit, and MUST fail with a message listing the files and instructing to resolve per `git-finish.mdc` then run finish again. It MUST run `pnpm verify:fast:quiet` after a successful auto-resolve commit, and MUST NOT rebase or force-push.

#### Scenario: Pure-add index conflict merges

- **WHEN** finish detects a conflict with `main` that is only pure-add lines in `docs/roadmap.md` (and/or a lockfile clash without `package.json` conflict)
- **THEN** it merges, auto-resolves, runs `roadmap check`, verifies, and pushes without stopping for a human

#### Scenario: Modified-line or item-file conflict stops

- **WHEN** finish encounters a modified-line conflict in `docs/roadmap.md`, any conflict under an item file, or other non-allowlisted paths
- **THEN** it leaves the merge unresolved, does not commit, and reports with guidance to resolve per `git-finish.mdc` then run finish again

#### Scenario: Semantic conflict stops

- **WHEN** finish encounters overlapping semantic code conflicts
- **THEN** it stops and reports without force-push or rebase

### Requirement: Per-worktree e2e preview port

Local Playwright preview SHALL honor `E2E_PORT` (default `4173`) in Playwright config and preview/test scripts so parallel worktrees do not reuse another worktree’s server.

#### Scenario: Custom port binds preview

- **WHEN** `E2E_PORT` is set to a free port and e2e preview starts
- **THEN** the preview and Playwright `baseURL` use that port

## MODIFIED Requirements

### Requirement: Lessons journal for agents

The repository SHALL provide conflict-free lessons under `docs/lessons/` (per-entry files, with optional index). Per-change mandates in `openspec/config.yaml` SHALL require agents to read lessons before apply and to add a per-entry lesson file when a review finding repeats. `AGENTS.md` SHALL link to the lessons location for navigation only (no duplicated checklist).

#### Scenario: Lessons file present

- **WHEN** an agent opens the lessons location (`docs/lessons/` and optional index)
- **THEN** short durable rules derived from past mistakes are available as per-entry files

#### Scenario: Mandates reference lessons

- **WHEN** an agent loads OpenSpec apply guidance from `openspec/config.yaml`
- **THEN** the guidance requires reading lessons before apply and adding a per-entry lesson file when a review finding repeats

#### Scenario: AGENTS links lessons without checklist duplication

- **WHEN** an agent reads root `AGENTS.md`
- **THEN** it can find a navigation link to the lessons location and MUST NOT find a duplicated verification checklist for lessons updates

### Requirement: Product roadmap

The repository SHALL provide the execution plan as an index `docs/roadmap.md` (milestone blocks with goal lines, one single-line entry per item in priority order, `## Deferred (not scheduled)` and `## Archive` sections) plus one file per item under `docs/roadmap/<milestone>/<slug>.md`, finished milestones under `docs/roadmap/archive/<milestone>/`, and a process doc `docs/roadmap/RULES.md` that states 60 fps is part of done for feature work. Item openness SHALL be determined from item-file done status (with migration from historical index ticks). The index and item files SHALL change only through `scripts/roadmap.mjs` (`pnpm roadmap`), and `pnpm roadmap check` SHALL pass in `pnpm test` (warning, not failure, for a fully done but still-active milestone awaiting `roadmap archive`). `AGENTS.md` SHALL link to the roadmap and the `roadmap` skill. `openspec/config.yaml` context Doc budget SHALL mention the roadmap alongside other durable docs.

#### Scenario: Roadmap index present

- **WHEN** an agent runs `pnpm roadmap next`
- **THEN** it prints the first open non-contingency item with its milestone goal, title, file path and full scope, without the agent reading `docs/roadmap.md`

#### Scenario: Layout is validated

- **WHEN** `pnpm test` runs
- **THEN** `scripts/roadmap.test.mjs` runs `check` on the repository roadmap and fails on a missing or orphan item file, a duplicate slug, a multi-line index entry, an incomplete archive, or an index line whose tag or title differs from its item file; a fully done but still-active milestone is reported as a warning, not a hard failure

#### Scenario: AGENTS links roadmap

- **WHEN** an agent reads root `AGENTS.md`
- **THEN** it can find a navigation link to `docs/roadmap.md`, the `pnpm roadmap` command and the `roadmap` skill

#### Scenario: Config context mentions roadmap

- **WHEN** an agent loads project context from `openspec/config.yaml`
- **THEN** the Doc budget text mentions `docs/roadmap.md` and `pnpm roadmap`

### Requirement: Unattended roadmap item flow

The project SHALL provide `/next-roadmap-item` (optional `<slug>` argument) to run one open roadmap item end to end without editing CLI-generated `opsx-*` or `openspec-*` files. When `<slug>` is given, preflight SHALL use that slug; without it, behaviour matches bare `roadmap next` with the claimed set. Mandates stay in `openspec/config.yaml` and `.cursor/rules/git-finish.mdc`. Security-tagged or security-surface items continue and MUST pass Security Review before archive. Until ratchet or dependency-policy items merge, gate-config and dependency rules in the command scenarios apply. Preflight, finish, and reviewer briefing SHALL use `pnpm agent` composite commands instead of multi-call shell recipes for the same work.

#### Scenario: Command exists and points at SoT

- **WHEN** an agent opens `.cursor/commands/next-roadmap-item.md`
- **THEN** the command describes the end-to-end stages and references `openspec/config.yaml`, `git-finish.mdc` and skill `roadmap` as mandate sources without restating their full checklists

#### Scenario: Command uses composite agent CLI

- **WHEN** an agent follows `.cursor/commands/next-roadmap-item.md`
- **THEN** preflight and finish (and reviewer briefing) are expressed as `pnpm agent` invocations rather than expanded multi-call shell recipes for the same work

#### Scenario: Optional slug argument

- **WHEN** an agent runs `/next-roadmap-item <slug>`
- **THEN** preflight is invoked with `--slug <slug>`

#### Scenario: Security-tagged item continues to Security Review

- **WHEN** the selected roadmap item is tagged `(Security Review: …)` or touches the security surface
- **THEN** the unattended flow MUST continue (it MUST NOT stop solely for that reason) and MUST complete Security Review before archive

#### Scenario: Gate-config edit before ratchet lands

- **WHEN** the selected item edits a quality-gate config and `gate-ratchet`/`gate-ratchet-ci` are not yet merged
- **THEN** the edit MUST be strictly stricter and listed in the touch-set with a reason, or the run MUST stop

#### Scenario: New dependency before dependency-policy lands

- **WHEN** the change adds or changes a dependency and `dependency-policy` is not yet merged
- **THEN** apply MUST include `pnpm audit:ci` evidence and a Security Review pass before archive

#### Scenario: Item selection skips blocked work

- **WHEN** the command picks the next roadmap item without an explicit slug
- **THEN** it runs preflight/`roadmap next` with a claimed set that skips open-PR, remote, local, and worktree-held `feat|fix/*` slugs and `[contingency]` items; milestone archive is a separate post-merge step, not a side effect of `done`

#### Scenario: Defined stop conditions only

- **WHEN** the unattended run encounters a dirty working tree, a milestone review cut, intent that conflicts with a spec or open issue, or three red CI fix rounds
- **THEN** the run MUST stop and ask; a conflict with `main` MUST be auto-merged only for pure-add `docs/roadmap.md` and lockfile-only cases and MUST stop for any other conflict; otherwise the run MUST continue through archive and PR (CI wait policy follows the invoking command)
