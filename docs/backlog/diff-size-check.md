# diff-size-check

Tag: prep
Milestone: M2.1
Title: size limit on an item's initial scope; review fixes warn only (issue #72 H)

## Scope

- [ ] `docs/roadmap/RULES.md` "Change size" (the SoT; `openspec/config.yaml` `rules.proposal` and `AGENTS.md` point to it): the hard limit (target ~1000, max 1500 changed lines incl. tests) applies to an item's **initial scope**, i.e. the plan and the first implementation push. A plan over the limit is split in the roadmap (`pnpm roadmap add … --after <current>`) before any code is written. Review-fix commits go to the **same branch and PR** (no stacked PR-on-PR, no separate fix PR) and are not hard-limited; CI only warns on the total. Deferred findings still become next items. Rationale stated in one line: the limit protects the agent's context; a hard total limit would reward silencing review findings
- [ ] `scripts/check-diff-size.mjs` (with tests), shared by the local and CI checks: changed lines against the merge base with rename detection, excluding `pnpm-lock.yaml`, `openspec/changes/**`, binary files and image / photo assets by extension (including SVG)
- [ ] **Plan check:** `proposal.md` carries `**Size estimate:** <prod> prod + <tests> tests = <total>` (tests at the 85 mutation bar are typically 1–1.5× production). `pnpm agent size --plan`, run by the apply step before the first code commit and again by `finish`, fails when the line is missing or the total is over 1500 (warns over 1000) and prints the `pnpm roadmap add` split hint; the proposal reviewer checks the same line
- [ ] **First push:** `pnpm agent finish` on a branch without a PR counts merge-base..HEAD and refuses to push and open the PR above 1500 (warns above 1000). Later `finish` calls on the same PR only print the total
- [ ] **CI (`pr-policy`, `pull_request_target`, base-branch code):** on `opened` / `reopened` the merge-base..head count is the initial size; above 1500 it fails, and the job uploads `initial-size.json` (`pr`, `initialHead`, `lines`; 90-day retention) as an artifact of that trusted run. On `synchronize` / `edited` the step downloads the artifact of the PR's first `pr-policy` run (not editable from the head), repeats the initial verdict (an oversize initial push stays red; the fix is closing the PR and splitting the item), fails when `initialHead` is no longer an ancestor of the head (initial scope rewritten by force-push; after the PR is open, update from `main` by merge, e.g. `gh pr update-branch`), and reports review-fix lines (`initialHead..head`) and the total as a **warning only** above 1500, never a failure. A missing artifact fails closed with a re-run hint
- [ ] **No stub-then-fix:** on `opened`, `pr-policy` fails when the change's `tasks.md` still has unticked implementation tasks, so the first push is the whole planned scope. The CI report shows initial, review-fix and total lines and the `src/**` share
- [ ] No waiver file, label or override input (the earlier owner-waiver idea is dropped)
- [ ] Exclude `uikit/**` from the size count (UI kit is not app code, owner decision 2026-10-19).
- **Done when:** a proposal estimating 1600 lines fails `pnpm agent size --plan`; a PR opened at the size of PR #71 fails `pr-policy` and stays red after more commits; a 1400-line initial push followed by 600 lines of review fixes in the same PR passes with a total-size warning; a force-push that drops the initial head fails; a PR opened with unticked implementation tasks fails.
- **Size:** ~700 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #72 H; owner decision 18.10.2026

- **Reason:** Folded local diff-size into agent-self-check (pipeline-gates opt §3.2, owner 2026-10-20).
