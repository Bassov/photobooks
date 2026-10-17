# M2.1 — notes

**Order:** M2.1 (hardening and the agent loop) runs before every other open item, and product work starts only when **all** of M2.1 is done: then M2.2 (library and metadata), then M2.5 (design foundation). Items run in index order, and each assumes the items above it are merged. Source issues: #72 (process and gates, A–N), #50 (quality roadmap), #77 / #78 / #79 (agent pipeline), #47, #48. The **Done when:** line of each `[prep]` here is its success criteria.

**Phases** (index order; the notes live here, not in the index, so `pnpm roadmap next` stays short):

- **Phase 1 — Flaky e2e and test problems** (`rtk-adopt` … `strict-e2e`, 6 items): `rtk-adopt` first: local to the agent machine, no CI effect, and it compacts the output of the many repeat runs the flake work needs. Then every known flake is fixed in app code or with deterministic waits, proven by a CI burn-in, and PR e2e drops to zero retries with an empty `@flaky` list. Flakes go first because they confuse the agent and would randomly redden the new gates of phase 2.
- **Phase 2 — Review bottlenecks** (`codecov-patch-gate` … `agent-self-check`, 16 items): `codecov-patch-gate` first: the cheapest gate (~150 lines of YAML), and it would have failed PR #82 round 1. It comes after the flakes, not before them, because it is a new blocking check and phase 1 PRs are mostly e2e work it does not measure. Then the mechanical gates that would have caught PR #76, #81 and #82 (test-level weakening, file-wide Stryker disables, unscoped scripts, mutation 72%, stale PR numbers, bad follow-ups, oversize initial scope), and last the agent self-check that runs them before push.
- **Phase 3 — Token cuts** (`agent-pipeline-leftovers` … `agent-pipeline-run-audit`, 4 items): the remaining #77 / #79 work (one finish = one verify, CI summary from the report JSON), #78 (`docs/lessons.md` dissolved into checks and specs, necessary-minimum rules), then one audited run that closes #77 and #79.
- **Phase 4 — Rest of quality (#72, #50, #47, #48)** (`dependency-policy` … `agent-auto-merge`, 28 items): exclusions registry, test seams and mutation re-includes (including the `projectSession.ts` split), a11y, FSA e2e, e2e coverage merged into Codecov, spec traceability, dependency rules, budgets, prod smoke and auto-merge.

**The roadmap grows in place** (see "Change size"): a plan over the size limit is split into the next checkbox before coding, and deferred review findings become the next checkbox. Review fixes stay in the same branch and PR. From `roadmap-check-item-body` on, `pnpm roadmap check --base` rejects follow-ups without a Done when.

**Gate rules:** gate configs only get stricter. The ratchet runs from the base branch, and there is no label, waiver or agent override. Coverage and diff mutation stay at 85 (final). e2e coverage counts toward `codecov/patch`, but e2e never replaces unit tests for mutation. The size limit binds the initial scope of an item (plan + first push), not review fixes (`diff-size-check`). A new dependency proceeds when the automated dependency checks pass. `(Security Review: …)` annotations mean the Security Review sub-agent runs before archive, not that the owner is asked.

**Owner one-time setup (not agent items):**

- Branch protection on `main`, "Do not allow bypassing the above settings", required checks added as each first appears: today `checks`, `integration`, `lighthouse`, `stryker-diff`, `dependency-review`, `gitleaks`, `Analyze (javascript-typescript)`; add `codecov/patch`, `codecov/project` (`codecov-patch-gate`), `pr-policy` (`gate-ratchet`), `preview-qa` (`preview-qa-run`).
- Repository setting "Automatically delete head branches" on (issue #77 §5), and prune the merged remote branches once.
- Disable the Cursor MCP servers this project does not need (AGENTS.md "Pipeline MCP"); the pipeline happy path needs none.
- `CODECOV_TOKEN` available to `checks` and `integration`.
- Point `agent-pipeline-run-audit` to the transcript file of the measured run.
- Optional, later: the one-line `autoMerge: true` PR.
