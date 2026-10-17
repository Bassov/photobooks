# agent-self-check

Tag: prep
Milestone: M2.1
Title: agents self-review against the repo checklist before push

## Scope

- [ ] `quality/review-checklist.md`: the single review checklist (rows with ids, derived from the review brief: scope, size, gates, exclusions, disables, tests first, evidence, roadmap follow-ups, PR body, English). Reviewer agents and the PR template reference it instead of restating it
- [ ] `pnpm agent review-brief` embeds the checklist ids; the implementation reviewer answers each row `pass` / `n.a.` / `fail` with `file:line`
- [ ] `pnpm agent finish` runs `pnpm quality:self-check` before the first push: the ratchet and weakening rules in local mode against `origin/main`, the plan and initial-scope size (`pnpm agent size --plan` and the first-push count; review-fix pushes only print the total), `roadmap check --base`, `check-pr-body` on the drafted body, the NoCoverage / disable scan of the last local Stryker report, and a `tasks.md` tick-evidence scan (a ticked box with no test name, link or commit fails). One line per checklist id; any `fail` stops the push
- [ ] Reuses the `pr-policy` scripts; no duplicated rules
- **Done when:** `pnpm agent finish` on scratch branches that reproduce #76 (helper swap), #81 (file-wide disable, unscoped script) and #82 (stale numbers, contingency follow-up) refuses to push and names the failing checklist ids, and a clean branch passes in one call.
- **Size:** ~800 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** gap audit §3.2; BRIEF §10
