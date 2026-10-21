# M2.1 — notes

**Order:** M2.1 (core hardening and the agent loop) runs before every other open item. When this core is done, product work resumes: M2.2 (library and metadata), then M2.5 (design foundation). Items run in index order, and each assumes the items above it are merged. Source issues: #72 (process and gates, subset A–N), #50 (quality roadmap, flake/retry items), #77 / #78 / #79 (agent pipeline). The **Done when:** line of each `[prep]` here is its success criteria.

After M2.1, product work resumes (M2.2, M2.5); the rest of the hardening ideas live in `docs/backlog/`.

**Agent loop (current SoT):** apply uses `pnpm check:fast` (A: unit + patch-coverage; no stryker). Local mutation + changed e2e are quality **B** at stages 4/7/9. Stage 11 runs `check:integrity` + `quality:self-check` + `agent stamp-green`. Stage 12 `agent finish` is thin push+PR (no happy-path merge of `origin/main`). CI `stryker-diff.yml` remains the mutation merge bar. Some early M2.1 Done notes (stryker-in-check, fat finish, finish merge-main) are superseded — see those item Done notes.

**Phases** (index order; the notes live here, not in the index, so `pnpm roadmap next` stays short):

- **Phase 1 — Flaky e2e and cheap agent runs** (`e2e-burn-in` … `agent-pipeline-leftovers`, 10 items): `roadmap-parallel-agents` first (up to 5 parallel worktree agents); then every known flake is fixed in app code or with deterministic waits, proven by a CI burn-in; PR e2e drops to zero retries with an empty `@flaky` list; local agent runs stay targeted and quiet (one green run; flake proof from CI burn-in); then remaining #77 / #79 pipeline leftovers (compact check output; today split as `check:fast` / `check:integrity`). Flakes go next because they confuse the agent and would randomly redden the new gates of phase 2.
- **Phase 2 — Mechanical gates** (`codecov-patch-gate` … `agent-self-check`, 14 items): `codecov-patch-gate` then `e2e-coverage-flag` (merged unit+e2e patch coverage), the ratchet/weakening/Stryker/exclusion/size/PR-body gates, and the agent self-check (now stage 11, not inside finish).
- **Phase 3 — Findings journal dissolve** (`lessons-dissolve` … `necessary-minimum-rules`, 2 items): #78 (journal dissolved into checks and specs, necessary-minimum rules).
- **Phase 4 — Mutation re-includes** (`fsa-permission-fakes` … `project-session-mutation`, 11 items): unit-level FSA fakes, then bring currently excluded product files back under mutation (including the `projectSession.ts` split), because upcoming product work will touch those files.
- **Phase 5 — Pipeline audit** (`agent-pipeline-run-audit`, 1 item): one audited `/next-roadmap-item` run that closes the #77 / #79 measurement.

**The roadmap grows in place** (see "Change size"): a plan over the size limit is split into the next checkbox before coding, and deferred review findings become the next checkbox. Review fixes stay in the same branch and PR.

**Gate rules:** gate configs only get stricter. The ratchet runs from the base branch, and there is no label, waiver or agent override. Coverage and diff mutation stay at 85 (final); `pnpm stryker:diff` scores changed **line ranges** (not whole touched files). e2e coverage counts toward `codecov/patch`, but e2e never replaces unit tests for mutation. The size limit binds the initial scope of an item (plan + first push), not review fixes (`diff-size-check`). Until `docs/backlog/dependency-policy.md` is re-added and merged, a new dependency needs `pnpm audit:ci` evidence and a Security Review pass. `(Security Review: …)` annotations mean the Security Review sub-agent runs before archive, not that the owner is asked.

**Owner one-time setup (not agent items):**

- Branch protection on `main`, "Do not allow bypassing the above settings", required checks added as each first appears: today `checks`, `integration`, `lighthouse`, `stryker-diff`, `dependency-review`, `gitleaks`, `Analyze (javascript-typescript)`; add `codecov/patch` from `codecov-patch-gate` (owner-only — agents never edit branch protection; do not require a check Codecov never posts), then `pr-policy` (`gate-ratchet`). Project no-drop status and the components table live in `docs/backlog/codecov-project-components.md` until Codecov posts them here.
- Repository setting "Automatically delete head branches" on (issue #77 §5), and prune the merged remote branches once.
- Disable the Cursor MCP servers this project does not need (AGENTS.md "Pipeline MCP"); the pipeline happy path needs none.
- `CODECOV_TOKEN` available to `checks` and `integration`.
- Point `agent-pipeline-run-audit` to the transcript file of the measured run.
