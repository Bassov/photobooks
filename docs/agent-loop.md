# Agent loop

Procedural SoT for unattended and interactive agents. **Enforcement** (inventories, stamp, thin finish, pre-push) lives in `@albasov/ts-agent-rig`, `lefthook.yml`, and `quality/gates.json` — this file is what/when/stop only.

How for each stage lives elsewhere (do not duplicate here):

| Concern                                                  | How SoT                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| Proposal / design / tasks / specs shape                  | `openspec/config.yaml` `rules.*`                                        |
| Change-quality during implement (UI smoke, survivors, …) | `openspec/config.yaml` `operations.apply` (no stryker item in tasks.md) |
| Spec sync / archive / roadmap done                       | `openspec/config.yaml` `operations.archive`                             |
| Plan / impl review                                       | `.cursor/agents/openspec-*-reviewer.md` (Claude: `.claude/agents/`)     |
| Tests                                                    | skill `write-tests`                                                     |
| UI review                                                | skill `ui-review`                                                       |
| Commit/PR harness precedence                             | `.cursor/rules/git-finish.mdc`                                          |
| Unattended runner                                        | `.cursor/commands/next-roadmap-item.md` (Claude: `.claude/commands/`)   |
| Harness wiring                                           | `## Harnesses` below                                                    |

Stop only for: dirty tree, milestone review cut, intent vs spec/issue conflict. Else record assumptions and continue.

## Buckets (entry commands)

| Bucket | Entry                                                  | When                                         |
| ------ | ------------------------------------------------------ | -------------------------------------------- |
| **A**  | `pnpm check:fast` (`pnpm check`)                       | Apply loops; hand-push; finish if stamp miss |
| **B**  | `pnpm test:e2e:changed:quiet` then `pnpm stryker:diff` | Stages 4 / 7 / 9                             |
| **C1** | `pnpm check:integrity`                                 | Stage 11; hand-push; CI                      |
| **C2** | `pnpm quality:self-check`                              | Stage 11 only                                |

**B lanes:** `test:e2e:changed:quiet` is the functional lane (`E2E_LANE=functional`, no `frame-budget gates` describes). Run frame-budget only when the touch-set hits `src/render|perf|photo|assets`, filmstrip, pasteboard, `e2e/perf`, `e2e/*frame*` or a spec with a `frame-budget gates` describe: `E2E_LANE=perf E2E_COVERAGE=0 pnpm test:e2e:quiet -g "frame-budget gates"` (or `pnpm perf`). CI mirrors this: `e2e` (functional) and the scoped required `perf` job (`perf.yml`: 3 runs; red if a scenario fails in ≥2 runs or any frame blocks >50 ms; out of scope → green "not in scope"). Thresholds stay as in #249. A red nightly `perf` run on main → `pnpm roadmap add` a flake/perf item (no new GH issue).

Do not re-list inventory members here. Hand-push always runs C1+A via `ts-rig-ci hook-pre-push`. Thin `agent finish` sets `AGENT_THIN_FINISH=1` and skips C1+A only when the stage-11 green-tree stamp matches.

## Diff bases

| Context                                       | Base                          | Tip                   |
| --------------------------------------------- | ----------------------------- | --------------------- |
| CI / local **A** patch coverage               | merge-base with `origin/main` | `HEAD` / working tree |
| Stages 3–4 first **B**                        | `origin/main`                 | working tree / `HEAD` |
| After phase commit (5 / 8): re-run **B** only | that **phase commit**         | working tree / `HEAD` |

No commit in stages 3–4. Local patch coverage always scores vs branch base (`origin/main`), matching Codecov; phase commit (`STRYKER_DIFF_BASE`) is only for `e2e:changed` and `stryker:diff`.

## Stages

### 0 · Prep

- `pnpm -s agent preflight --json` [`--slug <slug>`]. Headless: the launcher preloads the env — **do not** `source scripts/agent-env.sh` (interactive shells still source it once).
- Shell hygiene (each of these is a permission denial otherwise; deny rules stay as they are):
  - Scratch files go under `.cache/agent/` (gitignored; `Write` creates it, or `mkdir -p .cache/agent`), never `/tmp`.
  - No `timeout` wrapper on any command (`stryker:diff`, dev-server waits, scripts), and no `sh -c` / `until … sleep` polling loops; the Bash tool `timeout` is the limit. To wait for a background dev server, check its log with `Grep` (e.g. for `Local`) and retry in a later call.
  - Edit files with `Edit`/`Write`, not `sed -i` or `python3`.
  - No `cd` / `git -C`: run from the worktree root and pass paths.
  - No inline `node -e` / `node --input-type=module -e` (or `python3 -c`) scripts, even read-only: the auto-mode classifier denies them. Read JSON reports (e.g. `reports/mutation/mutation.json`) with `Read`/`Grep`, and take Stryker counts from the `pnpm stryker:diff` output.
- Clean tree; `feat|fix/<slug>` from `origin/main`.
- Do **not** merge/rebase `origin/main` on the happy path (behind + unique commits → warn only).

### 1 · Plan

- Write OpenSpec artifacts via `pnpm agent instructions` / run card.
- **How:** `openspec/config.yaml` `rules.*` (incl. prep/contingency fast-track).
- **Lite track (`[lite]` items):** no `openspec/changes/<slug>`; the roadmap item and the PR body are the plan. Skip stages 1–2 and archive: in 10–11 `pnpm -s agent finalize <slug>` (no change dir → no delta-spec/archive; it proceeds to roadmap done+sync, C1, C2, stamp; if it errors on the missing change, run `pnpm roadmap done <slug>` + `sync`, `check:integrity`, `quality:self-check`, `stamp-green` by hand). Everything else stays: A, B (changed specs), `ui-review` + evidenced browser smoke when UI is in scope, stage 6 implementation reviewer on the diff, thin finish. The PR body MUST carry the plan (scope, touch-set, Done when).
- **Escalation:** apply passes ~200 changed lines or needs a spec delta / domain behavior → stop, re-tag the item `[feature]`/`[prep]` (or `roadmap add --after`) and run the normal track.

### 2 · Plan review

- `pnpm agent review-brief --out <file>`; `openspec-planning-reviewer` once (≤1 re-review). Skip on fast-track and lite; docs-only skips design checklist.
- **How:** `.cursor/agents/openspec-planning-reviewer.md`.

### 3 · Apply (cheap)

- Implement tasks; loop **A** until green (patch base = `origin/main`).
- **No commit.** No B / reviewers / manual-qa yet.
- **How:** `operations.apply` + skill `write-tests`.

### 4 · First B

- Run **B** once vs `origin/main` (full current diff). Fix; re-run failed slice; re-A if code changed (still no phase commit).
- Skip the e2e half of B when pointless (CI still runs e2e + perf); never skip `stryker:diff` on `src/` changes (`agent finish` runs it, 2-run cap). In-scope once: `audit:ci` / `test:lhci`.

### 5 · Phase commit

- First green checkpoint after A+B. SHA becomes local **B** scoring base for later rework (not A patch).
- Session split: brief says stop after stage 5 → print the SHA and exit. A fresh session resumes at stage 6 from `git log origin/main..HEAD`, `tasks.md` and the review brief; it does not redo stages 1–5.

### 6 · Implementation review

- `openspec-implementation-reviewer` once (incl. docs-only). Rework via A (patch vs `origin/main`); +1 delta re-review if code changed.
- **How:** `.cursor/agents/openspec-implementation-reviewer.md`.

### 7 · B after review (if needed)

- **B** only if prod/tests/e2e/UI changed since stage 5; else skip. Score vs **stage 5**.

### 8 · Phase commit

- Updates local **B** scoring base for stage 9 rework.

### 9 · Browser / security QA (if needed)

- `pnpm agent manual-qa` (N/A non-UI): scenarios from roadmap Browser/Perf + `tasks.md` `## Manual test scenarios`; paste OK/problem lines back into that section (not an Implementation checkbox).
- Skill `ui-review` when UI in scope; Security Review when tagged / security surface.
- Rework via A (patch vs `origin/main`); re-B only if UI/e2e/tests changed (B base = stage 8).

### 10–11 · Finalize

- `pnpm -s agent finalize <slug>`: delta-spec sync check → archive → roadmap done+sync → `check:integrity` → `quality:self-check` → `stamp-green`. Prints only failures + one OK line; fix what it prints, re-run, commit.
- **How:** `operations.archive`.

### 12 · Thin finish

- `pnpm -s agent finish --title "…" --body-file …` — push + create/update PR only.
- No happy-path merge of `origin/main`; no C2 in finish; skip A/C1 in pre-push when stamp matches.
- After push/PR: print the PR URL and exit. The orchestrator owns CI wait, sole-flake re-runs and merge. `pnpm agent ci-wait` only when the brief asks for it (never `gh pr checks --watch`).
- **How (precedence):** `.cursor/rules/git-finish.mdc`.

### 13 · CI fix (fresh session)

- Launched by the orchestrator with a short brief (tip SHA, failing check, log path). `pnpm agent ci-brief` → fix only that → A/B as needed (bases per Diff bases) → push → exit. No auto-merge main; sibling conflicts = orchestrator turn.

## Stryker C-session

Owner decision (c) on #267 (2026-10-29): killing mutants is not feature work. Thresholds are unchanged (diff break 85, 0 NoCoverage, no mutator excludes, no new Stryker disables, `stryker-diff` stays required).

- **Feature session:** run `pnpm stryker:diff` at most twice (initial + one fix attempt with real tests). If still < 85 or NoCoverage > 0: stop fixing, open the PR anyway. The PR body has a line `stryker: deferred to C-session` followed by the survivor files (file, score, survived / NoCoverage counts).
- **C-session:** a separate brief ([template](agent-loop/stryker-c-session-brief.md)) resumes the SAME branch/worktree (no RESET, no new PR). It adds tests only, or removes genuinely dead code; no feature work, no threshold / mutator / disable changes. It re-runs `stryker:diff` until >= 85 and 0 NoCoverage, pushes, prints the PR URL and exits.

## Parallel agents

Any open slug, out of order: `/next-roadmap-item <slug>` (preflight `--slug`). Claimed slug + non-overlapping touch-sets / worktrees. Index tick conflicts: skill `roadmap` (Close). Do not `git merge origin/main` in preflight/finish/apply on the happy path. Behind main without conflicts is OK for PR create.

## Harnesses

Same loop, same rules; harness files only wire it up. SoT text stays in `.cursor/`; `.claude/` holds wrappers and symlinks.

| Harness     | Headless launch                                                                        | Permissions / settings                                              |
| ----------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Cursor      | `cursor-agent -p --trust --force` with env preloaded (`source scripts/agent-env.sh`)   | `.cursor/cli.json`                                                  |
| Claude Code | `claude -p --settings .claude/settings.headless.json` with env preloaded (same script) | `.claude/settings.json` (shared) + `.claude/settings.headless.json` |

Claude Code entry: `CLAUDE.md` (imports `AGENTS.md` + always-on rules). Token stats: `pnpm agent stats <log>` reads `--output-format stream-json --verbose` logs.
