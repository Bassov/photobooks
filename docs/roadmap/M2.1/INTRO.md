# M2.1 — notes

**Order:** M2.1 (core hardening and the agent loop) still runs before every other open item. M2.5 (design foundation) has already shipped. When the remaining M2.1 items are done, product work continues with M2.2 (library and metadata). Items run in index order. Source issues: #72 (process and gates, subset A–N), #50 (quality roadmap, flake/retry items), #77 / #78 / #79 (agent pipeline). The **Done when:** line of each `[prep]` here is its success criteria.

Prior M2.1 phases (flake hardening, mechanical gates, findings-journal dissolve, FSA/session split, reusable CI) are retired from the index; their item files live in git history.

**Agent loop SoT:** [`docs/agent-loop.md`](../../agent-loop.md). CI `stryker-diff.yml` remains the mutation merge bar. Early M2.1 Done notes that conflicted with the current loop are superseded (git history).

**Remaining open work** (index order):

- **`codecov-validate-timeout`** `[contingency]`: only if Codecov YAML validate hangs trip the Vitest timeout — abort hung `api.codecov.io/validate` within ~2.5s.
- **`mutation-reinclude-small`**: mutate `previewAspect.ts` and `upgradeSessionAssets.ts` again (issue #72 B).
- **`mutation-reinclude-camera`**: mutate `usePasteboardCamera.ts` again (issue #72 B).
- **`project-session-mutation`**: mutate what is left of `projectSession.ts`; clear remaining `temporary` exclusions (issue #72 B).
- **`agent-pipeline-run-audit`**: one audited `/next-roadmap-item` run against the #77 / #79 targets.

**The roadmap grows in place** (see "Change size"): a plan over the size limit is split into the next checkbox before coding, and deferred review findings become the next checkbox. Review fixes stay in the same branch and PR.

**Gate rules:** gate configs only get stricter. The ratchet runs from the base branch, and there is no label, waiver or agent override. Coverage and diff mutation stay at 85 (final); `pnpm stryker:diff` scores changed **line ranges** (not whole touched files). e2e coverage counts toward `codecov/patch`, but e2e never replaces unit tests for mutation. The size limit binds the initial scope of an item (plan + first push), not review fixes (`diff-size-check`). Until `docs/backlog/dependency-policy.md` is re-added and merged, a new dependency needs `pnpm audit:ci` evidence and a Security Review pass. `(Security Review: …)` annotations mean the Security Review sub-agent runs before archive, not that the owner is asked.

**Owner one-time setup (not agent items):**

- Branch protection on `main`, "Do not allow bypassing the above settings", required checks added as each first appears: today `checks`, `integration`, `lighthouse`, `stryker-diff`, `dependency-review`, `gitleaks`, `Analyze (javascript-typescript)`; add `codecov/patch` from `codecov-patch-gate` (owner-only — agents never edit branch protection; do not require a check Codecov never posts), then `pr-policy` (`gate-ratchet`). Project no-drop status and the components table live in `docs/backlog/codecov-project-components.md` until Codecov posts them here.
- Repository setting "Automatically delete head branches" on (issue #77 §5), and prune the merged remote branches once.
- Disable the Cursor MCP servers this project does not need (AGENTS.md "Pipeline MCP"); the pipeline happy path needs none.
- `CODECOV_TOKEN` available to `checks` and `integration`.
- Point `agent-pipeline-run-audit` to the transcript file of the measured run.
