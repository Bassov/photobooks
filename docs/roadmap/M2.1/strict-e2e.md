# strict-e2e

Tag: prep
Milestone: M2.1
Title: no hidden flakes (#50 item 5)

## Scope

- [ ] Playwright CI retries go to 0 on `pull_request` (`quality/gates.json`). Known-flaky tests move to an `@flaky` job that may retry and reports its flake count; that list may only shrink. Remove the per-spec `retries` overrides
- [ ] `write-tests` skill: assert concrete outcomes (`data-asset-id`, `src`, the asset in each frame), not just counts. Rewrite the PR #45 swap and move assertions
- **Done when:** PR e2e runs with no retries, the CI report shows the flake count, and the swap / move specs check the asset in each frame.
