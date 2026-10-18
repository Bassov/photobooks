# roadmap-parallel-agents-mutation-coverage

Tag: prep
Milestone: M2.1
Title: Zero NoCoverage on parallel-agents script mutation survivors

## Scope

- [ ] Drive script diff mutation NoCoverage on `scripts/agent.mjs` / `scripts/roadmap.mjs` (parallel-agents leftovers: finish non-FF catch paths, switchFeatureBranch fallback, archive CLI edges) to zero while keeping score ≥ 85
- **Done when:** `pnpm stryker:diff` on those files reports 0 NoCoverage and score ≥ 85
- **Size:** ~400 changed lines
- **Source:** roadmap-parallel-agents Done when (mutation ≥85, no NoCoverage); survivors after first shipping PR
