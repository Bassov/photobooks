# agent-self-check

Tag: prep
Milestone: M2.1
Title: agents self-review against the repo checklist before push
Status: done
Done note: local patch coverage, quality:self-check, review-checklist, manual-qa; folded pr-body-check + diff-size-check (§3.2).

## Scope

- [x] `quality/review-checklist.md`: the single review checklist (rows with ids, derived from the review brief: scope, size, gates, exclusions, disables, tests first, evidence, roadmap follow-ups, PR body, English). Reviewer agents and the PR template reference it instead of restating it
- [x] `pnpm agent review-brief` embeds the checklist ids; the implementation reviewer answers each row `pass` / `n.a.` / `fail` with `file:line`
- [x] `pnpm agent finish` runs `pnpm quality:self-check` before the first push: the ratchet and weakening rules in local mode against `origin/main`, the plan and initial-scope size (`pnpm agent size --plan` and the first-push count; review-fix pushes only print the total), `roadmap check --base`, `check-pr-body` on the drafted body, the NoCoverage / disable scan of the last local Stryker report, and a `tasks.md` tick-evidence scan (a ticked box with no test name, link or commit fails). One line per checklist id; any `fail` stops the push
- [x] Reuses the `pr-policy` scripts; no duplicated rules
- [x] Manual check runs in an isolated QA subagent (Cursor subagent definition under `.cursor/agents/manual-qa.md`; if the CLI has no subagents, a separate headless `cursor-agent -p` call from `pnpm agent manual-qa`) on the cheapest model `composer-2.5` (pinned in the subagent frontmatter `model: composer-2.5`; headless fallback passes `--model composer-2.5`; main coding agents stay on `auto`): input = the item's Browser check / Perf lines and the change's scenarios; it starts the app, drives each scenario headless with Playwright (Chromium, CPU throttle 4x for Perf lines, counts long animation frames vs main), and returns only `OK <scenario>` lines or numbered problems (`<scenario>: expected / observed`). The main agent pastes that output into `## Manual test scenarios`; any problem = Playwright test + fix before push. `openspec/config.yaml` Manual check task collapses to "run `pnpm agent manual-qa`".

Order (owner 2026-10-19): implement the local patch coverage box first.

- [x] Local patch coverage before push: `pnpm check` computes coverage of changed lines vs `origin/main` from the Vitest lcov (same paths/flags as `codecov.yml` `unit`, threshold read from the gate values file, 85%), prints `patch coverage NN.N% (file:lines uncovered)` in one line on failure, and fails below the threshold; `pnpm agent finish` runs it before the first push and before every fix push.
- [x] Real-input proof: when a change reads an external format (tool output, Cursor `store.db`, CI/API payload, config file of another tool), at least one test uses a fixture captured from the real tool, committed under `test/fixtures/real/` with a first-line header naming the command and date it was captured from; the Done-when proof must run on a real input, not only a hand-written fixture. New checklist row `real-input` in `quality/review-checklist.md`; `pnpm quality:self-check` fails when a changed parser/reader module has tests but no `test/fixtures/real/` file referenced by them.
- **Done when:** `pnpm agent finish` on scratch branches that reproduce #76 (helper swap), #81 (file-wide disable, unscoped script) and #82 (stale numbers, contingency follow-up) refuses to push and names the failing checklist ids, and a clean branch passes in one call; `pnpm agent manual-qa` on a scratch branch with a seeded UI bug returns a numbered problem for the affected scenario and only OK lines on main; the subagent definition pins `composer-2.5`; a scratch branch with uncovered new lines (repro of #109 r1, codecov/patch 61.84%) fails `pnpm check` locally with the uncovered `file:lines`, and the local percentage is within 2 points of `codecov/patch` on the same head; a scratch branch with a parser tested only on a hand-written fixture (repro of #109 r1) fails `quality:self-check` on `real-input`.
- **Size:** ~1300 changed lines (target ~1300, max 1800 incl. tests)
- **Source:** gap audit §3.2; BRIEF §10; owner request 2026-10-18 (save main-agent context; real, not paper, manual testing); review findings #93, #95, #96, #97, #109 (patch coverage found only in CI; invented inputs instead of real tool output; owner decision 2026-10-19)
