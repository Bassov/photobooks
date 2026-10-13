# Proposal

## Problem

Coverage upload is soft-fail and invisible on PRs; Prettier is only local-hook-enforced; dependency/secret gaps beyond audit+CodeQL are unchecked. Mutation testing runs on PRs but scores stay buried in logs.

## Why now

CI is still small and free on the public repo—add gates and PR-visible coverage/mutation reports before more product surface lands.

## Scope in

- Coverage no-regression floor + Codecov PR visibility when token is configured
- Format check in CI; Dependabot; lockfile dependency review on PRs
- Secret scanning via CI linter on PR/push; LHCI also on default-branch push
- PR-visible mutation score + downloadable HTML mutation report; job Step Summaries for coverage and mutation
- `ci-gates` capability; short AGENTS/README notes for Codecov token and enabling GitHub secret scanning

## Scope out

- Knip, Sonar, Semgrep, Snyk, bench-on-PR, Stryker metrics upload to Codecov
- Product/runtime UI changes
- Replacing existing `audit:ci` or CodeQL

## Capabilities

### New Capabilities

- `ci-gates`: CI quality/security gates and PR-visible coverage + mutation reporting

### Modified Capabilities

- (none)

## Success criteria

- PR fails on format drift, coverage below floor, dependency-review findings, or CI secret-linter hits
- Codecov PR comment when token is set; mutation sticky comment + HTML artifact on PR mutation job
- Step Summaries present for coverage and mutation jobs
- LHCI on default-branch push; Dependabot weekly PRs
- AGENTS/README note documents Codecov token and GitHub secret scanning / push protection
- `audit:ci` and CodeQL remain required on PRs/push; new dep gates do not replace them

## Risks

- **Security:** Dependabot/dependency-review must not weaken audit:ci/CodeQL; secret-linter false positives; keep Codecov token secret
- Coverage floors too aggressive if not measured first
- Sticky PR comments need write permission or they fail silently
