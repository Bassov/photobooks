# codecov-pr-comment-flags

Tag: prep
Milestone: M2.1
Title: Codecov PR comment shows the unit and e2e flags table

## Scope

- [ ] The Codecov PR comment lists the `unit` and `e2e` flags separately (Flags table), next to the existing patch summary
- **Done when:** a PR comment from Codecov on this repo contains a Flags section with separate `unit` and `e2e` rows.
- **Size:** ~50 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #72 A; owner decision 2026-10-19 from `e2e-coverage-flag` (PR #110)
- **Reason:** Codecov does not render the Flags table in PR comments on this repo, even with a valid `codecov.yml` that has `flags` in `comment.layout` and `behavior: new`/`default` (verified on PRs #104–#110 and scratch #112, comments 6255332821 and 6255339951). The Codecov API does report both flags with distinct coverage (head `72f364f`: unit 89.23% / e2e 59.93%; probe line unit miss / e2e hit), so `e2e-coverage-flag` was narrowed to the API proof. Keep the YAML keys (valid, harmless).
