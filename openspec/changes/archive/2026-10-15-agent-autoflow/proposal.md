## Problem

Roadmap work still needs manual handoffs between propose, review, apply, archive, PR, and CI. Dry-run blockers: planning stops at `opsx-propose`; Manual check and Docs/rules sync are undefined; roadmap tick policy disagrees with practice; CI wait / fix limits are missing.

## Why now

#56 defines the unattended orchestrator; #49's sync and drift cleanup land in the same docs-only apply so later items stop repeating those gaps.

## Scope in

- `/next-roadmap-item`: one roadmap item end to end (CLI planning + reviewers → apply → Manual check → archive → PR → green CI); stop only on listed conditions (incl. security-tagged items).
- Codify Manual check, Docs/rules sync, validate --strict, mutation/coverage triage, archive+tick, Browser/Perf criteria, and lesson tags in config + reviewers; PR template + git-finish CI wait.
- Align roadmap tick text; Perf/Browser backfill on three shipped features; #49 drift cleanup; `agent-context` delta; AGENTS nav line.

## Scope out

- Product/runtime code; CLI-generated opsx/openspec edits; new alwaysApply rule; new security-reviewer agent; parallel multi-item runs.

## Success criteria

- One command can take a roadmap item from fresh `main` to a green PR; stops only on dirty tree, milestone cut, security-tagged item, intent conflict, 3 red CI rounds, or PR↔main conflict.
- CLI planning (not `/opsx-propose`) with proposal/design reviewers to pass; validate --strict before apply.
- `tasks.md` has Docs/rules sync + Manual check; archive refused until both checked; PR carries Manual test scenarios + Docs/rules updated; CI awaited to green or stop after 3 red rounds.
- Survivors/uncovered lines triaged before impl review (skipped listed with reasons); tick policy matches archive (tick in PR after archive); no opsx/openspec edits; no new alwaysApply; `AGENTS.md` ≤150; #49 drift fixed.

## Risks

- Planning boundary is model text — command authorizes e2e and avoids `/opsx-propose`.
- Spec merge conflicts if parallel items run — one at a time.
- No security-reviewer agent — stop-and-ask on security-tagged items.
