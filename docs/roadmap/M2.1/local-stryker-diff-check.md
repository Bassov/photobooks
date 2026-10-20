# local-stryker-diff-check

Tag: prep
Milestone: M2.1
Title: Local stryker:diff in pnpm check / pre-push (agent loop)

## Scope

- [ ] Add `stryker-diff` to `quality/gates.json` `checks.afterUnit` (after `patch-coverage`) so Lefthook pre-push / `pnpm check` runs line-scoped `pnpm stryker:diff`
- [ ] Skip exit 0 when no mutable scored ranges (docs-only / comment-only); fail when changed-line mutants are NoCoverage or score < 85
- [ ] Sync docs/rules: openspec/config.yaml apply guidance, AGENTS.md, README.md, `.cursor/rules/testing.mdc` + `git-finish.mdc`, agent APPLY procedure text (rig pin if needed), agent-self-check cross-link
- **Done when:** a killable mutant on a changed `src/` line fails local `pnpm check` before push; docs-only / empty scored ranges stay green; CI `stryker-diff` behavior unchanged
- **Size:** ~200 lines
- **Source:** M2.1 mutation local loop plan (agent loop gap: patch coverage local, mutation only in CI)
