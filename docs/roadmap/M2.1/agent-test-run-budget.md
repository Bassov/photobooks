# agent-test-run-budget

Tag: prep
Milestone: M2.1
Title: agent test runs stay cheap and fast; flake proof comes from CI burn-in (owner 2026-10-18)
Status: done

## Scope

Why: since e2e-burn-in, agent sessions grew from ~30-40 min to 1-2.5 h per item, mostly local repeat runs of e2e specs and long test output in the context. CI burn-in already repeats changed specs 10x, so local repeats duplicate it and burn tokens even when there is no flake.

- [x] AGENTS.md / next-roadmap-item command: local test policy. Run only the targeted unit tests and the changed e2e specs, once, in quiet mode (`test:quiet`, `test:e2e:quiet` with a spec filter). One green local run is enough; flakes are caught in CI (burn-in), not locally. Exception: a test failed locally and then passed on rerun (a flake surfaced locally) - only then may the agent repeat that spec, max 3 (`--repeat-each=3`), to investigate or prove the fix. The full e2e suite and burn-in run in CI, not locally.
- [x] A quiet script for targeted e2e (e.g. `pnpm test:e2e:changed:quiet`) that runs only specs touched by the diff (reuse the burn-in target resolver) and prints only failures + a one-line summary.
- [x] `pnpm agent finish` / the command flow: after push the agent does not wait on or watch CI (no `gh pr checks --watch`, no polling loops); it opens the PR and stops. The reviewer reads CI.
- [x] Burn-in on CI: when the diff touches no e2e spec and no e2e support file, the burn-in job exits immediately with "no targets" (no browser install, no build); it runs in parallel with `integration`, not after it.
- [x] Record per-run wall time and, if the CLI reports it, token usage in the PR body metrics (auto, not typed) so regressions are visible; feeds `agent-pipeline-run-audit`.

- **Done when:** AGENTS.md and the command state the local test policy; the targeted quiet e2e script exists with tests (in coverage and mutation); burn-in no-op path is measured under 1 min on a PR with no e2e changes; one agent run on a small item shows no local repeat loop in its log.

## Done note

local once-green policy + test:e2e:changed:quiet; finish stops at PR URL; parallel burn-in no-op; PR metrics wall_time/tokens; burn-in <1min evidence from this PR CI; no local e2e repeat loop noted for agent-pipeline-run-audit
