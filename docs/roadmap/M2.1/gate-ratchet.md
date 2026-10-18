# gate-ratchet

Tag: prep
Milestone: M2.1
Title: gate values can only get stricter (issue #72 K, replaced by a ratchet)

## Scope

- [ ] `scripts/check-gate-ratchet.mjs` in a new `.github/workflows/pr-policy.yml` on `pull_request_target`, so the workflow and the script run from the base branch. The head tree is read only as data (`git fetch` of the head SHA, static YAML / JSON parsing); no head code runs
- [ ] Fail when, versus base: any value in `quality/gates.json` or `codecov.yml` gets weaker (lower target or score, higher threshold or budget, more retries, `informational` turned on); a status, flag, component or assertion is removed; a `stryker.config.json` `mutate` `!` pattern or a `coverage.exclude` / Codecov `ignore` pattern is added; a Vitest coverage `include` entry or a Codecov `flags.*.paths` entry is removed; Stryker `mutator.excludedMutations`, `ignorers`, `disableTypeChecks`, `coverageAnalysis` or `ignoreStatic` change in the weaker direction; `pnpm.patchedDependencies` grows; a `v8|istanbul|c8 ignore`, blanket `eslint-disable` or `@ts-ignore` line is added; or a gate file is renamed or deleted
- [ ] `Stryker disable` lines: owned by `stryker-disable-budget` (only the next-line form is legal). Until that item lands, the ratchet rejects every new `Stryker disable` line (the #81 file-wide form is the reason)
- [ ] Self-protection: the head's rule-id list and rule fixture tests must be a superset of the base's, so the ratchet itself can only grow. No label or override input exists
- [ ] `ci-gates` spec delta: the ratchet and the `pr-policy` check. Owner setup: `pr-policy` becomes a required check
- [ ] Required-check jobs keep their gates: versus base, a gate step (Playwright e2e / burn-in, Vitest coverage, Stryker, Lighthouse, gitleaks, audit) that ran inside a job whose name is a required check (`checks`, `integration`, `lighthouse`, `stryker-diff`, ...) may not be removed, get `continue-on-error`, or move to another job, unless the required job `needs:` that job and fails when it fails (static YAML check, list of required job names in `quality/gates.json`).
- **Done when:** fixture PRs that lower a threshold, add an exclude pattern, remove `scripts/agent.mjs` from coverage `include`, add `mutator.excludedMutations`, add a `v8 ignore`, add any `Stryker disable` line, or delete a ratchet rule each fail `pr-policy`, and editing `pr-policy.yml` or the ratchet script in a PR does not change how that PR is judged; a fixture PR that moves the burn-in step out of `integration` into a parallel job the `integration` job does not depend on (PR #93 r1) fails `pr-policy`, and the same move with an aggregating `integration` job that `needs:` it passes.
- **Size:** ~900 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #72 K; review findings PR #93 M1 (burn-in moved from the required `integration` job to a non-required `e2e-burn-in` job). Gate weakening -> added after one occurrence (owner rule).
