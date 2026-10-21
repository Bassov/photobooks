# Agent loop

Procedural SoT for unattended and interactive agents. **Enforcement** (inventories, stamp, thin finish, pre-push) lives in `@albasov/ts-agent-rig`, `lefthook.yml`, and `quality/gates.json` — this file is what/when/stop only.

How for each stage lives elsewhere (do not duplicate here):

| Concern                                                  | How SoT                                                                 |
| -------------------------------------------------------- | ----------------------------------------------------------------------- |
| Proposal / design / tasks / specs shape                  | `openspec/config.yaml` `rules.*`                                        |
| Change-quality during implement (UI smoke, survivors, …) | `openspec/config.yaml` `operations.apply` (no stryker item in tasks.md) |
| Spec sync / archive / roadmap done                       | `openspec/config.yaml` `operations.archive`                             |
| Plan / impl review                                       | `.cursor/agents/openspec-*-reviewer.md`                                 |
| Tests                                                    | skill `write-tests`                                                     |
| UI review                                                | skill `ui-review`                                                       |
| Commit/PR harness precedence                             | `.cursor/rules/git-finish.mdc`                                          |
| Unattended runner                                        | `.cursor/commands/next-roadmap-item.md`                                 |

Stop only for: dirty tree, milestone review cut, intent vs spec/issue conflict. Else record assumptions and continue.

## Buckets (entry commands)

| Bucket | Entry                                                  | When                                         |
| ------ | ------------------------------------------------------ | -------------------------------------------- |
| **A**  | `pnpm check:fast` (`pnpm check`)                       | Apply loops; hand-push; finish if stamp miss |
| **B**  | `pnpm test:e2e:changed:quiet` then `pnpm stryker:diff` | Stages 4 / 7 / 9                             |
| **C1** | `pnpm check:integrity`                                 | Stage 11; hand-push; CI                      |
| **C2** | `pnpm quality:self-check`                              | Stage 11 only (needs final PR body)          |

Do not re-list inventory members here. Hand-push always runs C1+A via `ts-rig-ci hook-pre-push`. Thin `agent finish` sets `AGENT_THIN_FINISH=1` and skips C1+A only when the stage-11 green-tree stamp matches.

## Diff bases

| Context                                        | Base                          | Tip                   |
| ---------------------------------------------- | ----------------------------- | --------------------- |
| CI                                             | merge-base with `origin/main` | `HEAD`                |
| Stages 3–4 (first A + first B)                 | `origin/main`                 | working tree / `HEAD` |
| After phase commit (5 / 8): re-run A patch + B | that **phase commit**         | working tree / `HEAD` |

No commit in stages 3–4. CI never scores vs phase commits.

## Stages

### 0 · Prep

- `source scripts/agent-env.sh` once; `pnpm -s agent preflight --json` [`--slug <slug>`].
- Clean tree; `feat|fix/<slug>` from `origin/main`.
- Do **not** merge/rebase `origin/main` on the happy path (behind + unique commits → warn only).

### 1 · Plan

- Write OpenSpec artifacts via `pnpm agent instructions` / run card.
- **How:** `openspec/config.yaml` `rules.*` (incl. prep/contingency fast-track).

### 2 · Plan review

- `pnpm agent review-brief --out <file>`; `openspec-planning-reviewer` once (≤1 re-review). Skip on fast-track; docs-only skips design checklist.
- **How:** `.cursor/agents/openspec-planning-reviewer.md`.

### 3 · Apply (cheap)

- Implement tasks; loop **A** until green (patch base = `origin/main`).
- **No commit.** No B / reviewers / manual-qa yet.
- **How:** `operations.apply` + skill `write-tests`.

### 4 · First B

- Run **B** once vs `origin/main` (full current diff). Fix; re-run failed slice; re-A if code changed (still no phase commit).
- Skip B when pointless (CI still runs e2e + stryker-diff). In-scope once: `audit:ci` / `test:lhci`.

### 5 · Phase commit

- First green checkpoint after A+B. SHA becomes local scoring base for later rework.

### 6 · Implementation review

- `openspec-implementation-reviewer` once (incl. docs-only). Rework via A with patch base = stage 5; +1 delta re-review if code changed.
- **How:** `.cursor/agents/openspec-implementation-reviewer.md`.

### 7 · B after review (if needed)

- **B** only if prod/tests/e2e/UI changed since stage 5; else skip. Score vs **stage 5**.

### 8 · Phase commit

- Updates local scoring base for stage 9 rework.

### 9 · Browser / security QA (if needed)

- `pnpm agent manual-qa` (N/A non-UI): scenarios from roadmap Browser/Perf + `tasks.md` `## Manual test scenarios`; paste OK/problem lines back into that section (not an Implementation checkbox).
- Skill `ui-review` when UI in scope; Security Review when tagged / security surface.
- Rework via A (base = stage 8); re-B only if UI/e2e/tests changed (B base = stage 8).

### 10 · Archive + PR body

- Sync delta specs; `pnpm agent archive <slug>`; `pnpm roadmap done <slug>`; commit if needed.
- Draft **final** PR body (`.github/PULL_REQUEST_TEMPLATE.md`) so stage 11 C2 is not stale.
- **How:** `operations.archive`.

### 11 · Final gates + stamp

- `pnpm check:integrity`; `pnpm quality:self-check --body-file …`; `pnpm agent stamp-green`.
- Do not rewrite PR body after C2 without re-running C2.

### 12 · Thin finish

- `pnpm -s agent finish --title "…" --body-file …` — push + create/update PR only.
- No happy-path merge of `origin/main`; no C2 in finish; skip A/C1 in pre-push when stamp matches.
- Stop after PR URL — no `gh pr checks --watch`.
- **How (precedence):** `.cursor/rules/git-finish.mdc`.

### 13 · CI fix loop

- `pnpm agent ci-brief` → fix → A/B as needed (bases per Diff bases) → push. No auto-merge main; sibling conflicts = orchestrator turn.

## Parallel agents

Claimed slug + non-overlapping touch-sets / worktrees. Do not `git merge origin/main` in preflight/finish/apply on the happy path. Behind main without conflicts is OK for PR create.
