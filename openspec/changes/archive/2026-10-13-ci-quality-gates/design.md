# Design

## Context

See proposal.md. Today: `checks` runs typecheck, lint, `test:coverage`, build, `audit:ci`, soft Codecov upload; no format check or coverage thresholds. `stryker-diff` has no PR comment/artifact; `stryker-full` already uploads HTML. No Dependabot, dependency-review, or gitleaks. LHCI is PR-only. Measured Vitest coverage (~43% lines) sets the no-regression floor.

## Goals / Non-Goals

**Goals:** Fail closed on format/coverage/deps/secrets; PR-visible Codecov + mutation; Step Summaries; keep audit:ci + CodeQL.

**Non-Goals:** New SaaS beyond Codecov; changing product code; raising coverage via new tests in this change.

## Touch-set

- `.github/workflows/checks.yml` — format:check; Codecov with token + conditional `fail_ci_if_error`; coverage Step Summary from `coverage/coverage-summary.json`
- `.github/workflows/stryker-diff.yml` — permissions; post-steps with `if: always()` when report exists (artifact, summary, sticky comment)
- `.github/workflows/stryker-full.yml` — Step Summary via same script
- `.github/workflows/lighthouse.yml` — `push` to `main` + brief summary if cheap
- New: `.github/workflows/dependency-review.yml` (`fail-on-severity: high`), `.github/workflows/gitleaks.yml`
- New: `.github/dependabot.yml`, `codecov.yml`
- `stryker.config.json` — add `json` reporter (output under `reports/mutation/`)
- `scripts/stryker-pr-summary.mjs` — reads `reports/mutation/mutation.json` → markdown
- `vite.config.ts` — `coverage.thresholds` + `json-summary` reporter
- `AGENTS.md` — `ci-gates` map row + secrets note
- `README.md` — short CI secrets note

## Decisions

1. **Coverage floors** — Measured rounded-down ints: statements 43, branches 46, functions 33, lines 43. Vitest thresholds are the **hard** CI gate. Alternative: shrink coverage include — deferred.

2. **Codecov** — Root `codecov.yml`: project target aligned to floors; patch informational (no required status / do not fail CI on patch alone); flag `unit`; ignore `e2e/**`/`scripts/**`; `comment` enabled. Upload uses `token: ${{ secrets.CODECOV_TOKEN }}` and `fail_ci_if_error: ${{ secrets.CODECOV_TOKEN != '' }}` so missing token does not red-fail checks. Operators set the secret for PR comments; Vitest remains the blocking coverage gate.

3. **Coverage Step Summary** — Add Vitest reporter `json-summary`; after coverage, append totals from `coverage/coverage-summary.json` to `$GITHUB_STEP_SUMMARY`.

4. **Mutation PR report** — Keep html + clear-text; add json (default path `reports/mutation/mutation.json`). Shared `scripts/stryker-pr-summary.mjs` emits markdown. On `stryker-diff`: after mutate step, always-run follow-ups (`if: always()`) that (a) skip cleanly when no report (empty mutate set), else (b) upload `reports/mutation/` artifact, (c) write Step Summary, (d) sticky PR comment via `marocchino/sticky-pull-request-comment@v2`. Permissions: `contents: read`, `pull-requests: write`. Nightly full job reuses the summary script.

5. **Dependabot over Renovate** — Native weekly npm + github-actions (covers pinned actions including sticky-comment, gitleaks, dependency-review). Group minor/patch where sensible.

6. **Dependency review** — `actions/dependency-review-action` with `fail-on-severity: high` on lockfile PR diffs; complements, does not replace, `audit:ci`.

7. **Gitleaks** — `gitleaks/gitleaks-action` on PR + push main; complements manual GitHub secret scanning / push protection.

8. **Module boundary** — Config/scripts only. Specs under `ci-gates`, not `agent-context`.

## Security

- Dependabot + dependency-review add supply-chain signal; `audit:ci` and CodeQL stay mandatory.
- Gitleaks reduces accidental secret commits; enable GitHub push protection after merge.
- `CODECOV_TOKEN` is a repository secret; never commit it.
- Sticky-comment workflow: least privilege `pull-requests: write` only on mutation job.

## Risks / Trade-offs

- [Low overall coverage] → Floors match today; raising coverage is a later change.
- [No Codecov token] → Upload stays non-blocking until secret is set; PR comments need the secret (documented).
- [Gitleaks noise] → Allowlist via `.gitleaks.toml` only after a real false positive.
- [Sticky comment permission] → Declare permissions explicitly on mutation workflow.

## Migration

1. Land workflows/config.
2. Set `CODECOV_TOKEN` for PR comments and fail-closed upload; enable GitHub Secret scanning + Push protection.
3. First Dependabot PRs may be noisy — batch merges acceptable.
4. Rollback: revert change / disable new workflows.
