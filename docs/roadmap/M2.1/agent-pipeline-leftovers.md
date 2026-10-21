# agent-pipeline-leftovers

Tag: prep
Milestone: M2.1
Title: Remaining token and call waste in the agent pipeline (issues #77, #79)
Status: done

## Scope

- [x] `pnpm agent finish`: run `verify:fast` once per push (today `verify:fast:quiet` runs and then pre-push runs `verify:fast` again); parse the pre-push result instead of re-running. Never `--no-verify`
- [x] `preflight`: warn and rebase-or-recreate when the reused local branch is behind `origin/main`; include the `quality/review-checklist.md` ids, not the text
- [x] `roadmap` / `openspec instructions` output: compact defaults where the agent only needs `{template, rules}` (the "polish as needed" left open in `agent-pipeline-fewer-calls`)
- [x] One entry point for every deterministic check: `pnpm check` (or `verify:fast` becomes it) runs lint, typecheck, unit tests (targeted when possible), `roadmap check`, mutation-scope / exclusions-registry, deps rules, local pr-policy / diff-size / pr-body checks where applicable, in one call. It does not stop at the first failure: all checks run (independent ones in parallel) and all problems are reported in one pass. Exit code non-zero if any failed. Local e2e stays separate (`test:e2e:changed:quiet`); CI and pre-push call the same entry.
- [x] Minimal output by default for every check-related command (`pnpm check`, each sub-check, `test:quiet`, `test:e2e:changed:quiet`, `stryker:diff`, `roadmap check`, `agent finish` CI summary (moved to pr-metrics-autogen)): success = one line `OK <check> (<n>, <time>)`; failure = only problems as `<check>: <file>:<line> <one-line message>`, capped (e.g. 20 lines per check, then `… +N more, full log: <path>`). No banners, progress bars, passing-test lists or stack traces beyond the first relevant frame. Full logs go to `.cache/checks/<check>.log`; `--verbose` restores full output (CI uses it in logs).
- [x] Docs collapse to one line: `openspec/config.yaml` (quality bar / apply guidance / tasks template), AGENTS.md and `.cursor/commands/next-roadmap-item.md` replace the list of individual check commands with "run `pnpm check` until it prints only OK lines"; the tasks.md template has a single verification task. Individual commands stay available but are not listed.
- [x] Works without rtk (rtk stays deferred): the compaction is in the project's own scripts, so CI and every agent get it.
- [x] Tests at the `scripts/agent.mjs` bar
- **Done when:** one `pnpm agent finish` happy path runs `verify:fast` exactly once, `preflight` flags a stale branch, and the agent tests cover each change; a fixture branch with three different failures (lint, unit, roadmap) shows all three in one `pnpm check` run, each in ≤ 20 lines; a passing run prints ≤ 1 line per check; openspec config/AGENTS.md/command mention one check command; the tool wrapper is covered by tests (in coverage and mutation scope); one agent round log shows check output reduced vs the round before (lines or tokens in the PR metrics).
- **Size:** ~400 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #77, #79; PR #81 N3/N6; owner 2026-10-18 review-findings (unified `pnpm check` + compact output)

## Done note

Shipped unified pnpm check + compact `--run` wrapper for standalone test:quiet / e2e-changed / stryker:diff / roadmap check; finish single pre-push verify; preflight stale merge-or-recreate + checklist ids; docs collapse. Finish CI-summary (moved to pr-metrics-autogen). Size re-estimate ~1300 LOC vs original ~400.

**Superseded (agent-loop stages):** SoT inventories are `pnpm check:fast` (A) and `pnpm check:integrity` (C1); hand-push runs both; `agent finish` is thin push+PR (no fat verify / no C2). Compact OK/problem output remains.
