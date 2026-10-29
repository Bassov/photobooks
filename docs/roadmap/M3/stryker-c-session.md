# stryker-c-session

Tag: prep
Milestone: M3
Title: Stryker survivors move to a dedicated C-session (Owner option (c), #267)
Status: done

## Scope

Owner decision (c) on #267 (Owner 2026-10-29): mutant-killing moves out of feature sessions into a dedicated C-session. Evidence: survivors so far were test gaps / dead code, not real bugs. Process and docs only.

- Policy text lives once in `docs/agent-loop.md` `## Stryker C-session`: a feature session runs `pnpm stryker:diff` at most twice; if still < 85 or NoCoverage > 0 it opens the PR with `stryker: deferred to C-session` plus the survivor files; a C-session resumes the same branch/worktree and adds tests (or removes dead code) until >= 85 and 0 NoCoverage.
- Reusable brief template: `docs/agent-loop/stryker-c-session-brief.md`.
- Hard nos: stryker diff break stays 85, 0 NoCoverage, no mutator excludes, no new Stryker disables, required check `stryker-diff` stays required; no change to `quality/gates.json`, stryker config, CI workflows or src/tests.

## Done when

- `docs/agent-loop.md` carries the feature-session and C-session policy; the brief template exists with all placeholders.
- No gate, threshold, mutator, config, workflow, src or test change in the diff.
