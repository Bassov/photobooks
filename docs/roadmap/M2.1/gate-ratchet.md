# gate-ratchet

Tag: prep
Milestone: M2.1
Title: gate values can only get stricter (issue #72 K, replaced by a ratchet)

## Scope

- [ ] `scripts/check-gate-ratchet.mjs` in a new `.github/workflows/pr-policy.yml` on `pull_request_target`, so the workflow and the script run from the base branch. The head tree is read only as data (`git fetch` of the head SHA, static YAML / JSON parsing); no head code runs
- [ ] Fail when, versus base: any value in `quality/gates.json` or `codecov.yml` gets weaker (lower target or score, higher threshold or budget, more retries, `informational` turned on); a status, flag, component or assertion is removed; a `stryker.config.json` `mutate` `!` pattern or a `coverage.exclude` / Codecov `ignore` pattern is added (once `exclusions-registry` lands, only patterns generated from a registry entry whose category check passes are accepted, e.g. `separate-package` for `uikit/**`); a `v8|istanbul|c8 ignore`, blanket `eslint-disable`, `@ts-ignore`, or `Stryker disable` line without a named mutator and reason is added; or a gate file is renamed or deleted
- [ ] Self-protection: the head's rule-id list and rule fixture tests must be a superset of the base's, so the ratchet itself can only grow. No label or override input exists
- [ ] `ci-gates` spec delta: the ratchet and the `pr-policy` check
- **Done when:** fixture PRs that lower a threshold, add an exclude pattern, add a `v8 ignore`, or delete a ratchet rule each fail `pr-policy`, and editing `pr-policy.yml` or the ratchet script in a PR does not change how that PR is judged.
