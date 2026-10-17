# dependency-policy

Tag: prep
Milestone: M2.1
Title: dependencies are checked automatically, not asked about

## Scope

- [ ] `dependency-review.yml`: `fail-on-severity: moderate`, an `allow-licenses` list (MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause, 0BSD, BlueOak-1.0.0, CC0-1.0), and `comment-summary-in-pr`
- [ ] `scripts/check-dependency-policy.mjs` in `pr-policy`. New or changed dependencies use exact versions (existing caret ranges may only decrease). `pnpm.onlyBuiltDependencies` does not grow (no new install scripts). A new package is at least 7 days old (pnpm `minimumReleaseAge`). `audit:ci` also fails on `moderate` for production and `high` for dev dependencies
- [ ] `openspec/config.yaml`: a new dependency is named in the design touch-set with its purpose. The Security Review sub-agent runs on it before archive; no owner stop
- **Done when:** fixture PRs adding a GPL package, a caret-ranged package, a package with an install script or a package published yesterday each fail, and a pinned MIT dev dependency passes with no human step.
