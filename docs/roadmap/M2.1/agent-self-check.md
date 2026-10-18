# agent-self-check

Tag: prep
Milestone: M2.1
Title: agents self-review against the repo checklist before push

## Scope

- [ ] `quality/review-checklist.md`: the single review checklist (rows with ids, derived from the review brief: scope, size, gates, exclusions, disables, tests first, evidence, roadmap follow-ups, PR body, English). Reviewer agents and the PR template reference it instead of restating it
- [ ] `pnpm agent review-brief` embeds the checklist ids; the implementation reviewer answers each row `pass` / `n.a.` / `fail` with `file:line`
- [ ] `pnpm agent finish` runs `pnpm quality:self-check` before the first push: the ratchet and weakening rules in local mode against `origin/main`, the plan and initial-scope size (`pnpm agent size --plan` and the first-push count; review-fix pushes only print the total), `roadmap check --base`, `check-pr-body` on the drafted body, the NoCoverage / disable scan of the last local Stryker report, and a `tasks.md` tick-evidence scan (a ticked box with no test name, link or commit fails). One line per checklist id; any `fail` stops the push
- [ ] Reuses the `pr-policy` scripts; no duplicated rules
- [ ] Manual check runs in an isolated QA subagent (Cursor subagent definition under `.cursor/agents/manual-qa.md`; if the CLI has no subagents, a separate headless `cursor-agent -p` call from `pnpm agent manual-qa`) on the cheapest model `composer-2.5` (pinned in the subagent frontmatter `model: composer-2.5`; headless fallback passes `--model composer-2.5`; main coding agents stay on `auto`): input = the item's Browser check / Perf lines and the change's scenarios; it starts the app, drives each scenario headless with Playwright (Chromium, CPU throttle 4x for Perf lines, counts long animation frames vs main), and returns only `OK <scenario>` lines or numbered problems (`<scenario>: expected / observed`). The main agent pastes that output into `## Manual test scenarios`; any problem = Playwright test + fix before push. `openspec/config.yaml` Manual check task collapses to "run `pnpm agent manual-qa`".
- **Done when:** `pnpm agent finish` on scratch branches that reproduce #76 (helper swap), #81 (file-wide disable, unscoped script) and #82 (stale numbers, contingency follow-up) refuses to push and names the failing checklist ids, and a clean branch passes in one call; `pnpm agent manual-qa` on a scratch branch with a seeded UI bug returns a numbered problem for the affected scenario and only OK lines on main; the subagent definition pins `composer-2.5`.
- **Size:** ~1100 changed lines (target ~1300, max 1800 incl. tests)
- **Source:** gap audit §3.2; BRIEF §10; owner request 2026-10-18 (save main-agent context; real, not paper, manual testing)
