# local-stryker-diff-check

Tag: prep
Milestone: M2.1
Title: Local stryker:diff in pnpm check / pre-push (agent loop)
Status: done
Done note: stryker-diff in checks.afterUnit; docs/rules + APPLY procedure (ts-agent-rig v0.2.4). **Superseded (agent-loop stages):** stryker is not in `check:fast` / pre-push; local mutation is agent B (stages 4/7/9) + CI `stryker-diff.yml`. Scope/Done when below are historical.

## Scope

- [x] Add `stryker-diff` to `quality/gates.json` `checks.afterUnit` (after `patch-coverage`) so Lefthook pre-push / `pnpm check` runs line-scoped `pnpm stryker:diff`
- [x] Skip exit 0 when no mutable scored ranges (docs-only / comment-only); fail when changed-line mutants are NoCoverage or score < 85
- [x] Sync docs/rules: openspec/config.yaml apply guidance, AGENTS.md, README.md, `.cursor/rules/testing.mdc` + `git-finish.mdc`, agent APPLY procedure text (rig pin if needed), agent-self-check cross-link
- **Done when:** a killable mutant on a changed `src/` line fails local `pnpm check` before push; docs-only / empty scored ranges stay green; CI `stryker-diff` behavior unchanged
- **Size:** ~200 lines
- **Source:** M2.1 mutation local loop plan (agent loop gap: patch coverage local, mutation only in CI)
