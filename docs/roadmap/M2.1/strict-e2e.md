# strict-e2e

Tag: prep
Milestone: M2.1
Title: no hidden flakes: zero retries on PRs (#50 item 5)
Status: done

## Scope

- [x] Playwright CI retries go to 0 on `pull_request` and `push`. Remove every remaining per-spec `retries` override. `trace: retain-on-failure` replaces `on-first-retry`
- [x] A test that still flakes after the two flake items moves to an `@flaky` job that may retry and reports its flake count; the list lives in `e2e/flaky.json` (moved into `quality/gates.json` and ratcheted by `gate-values-file`), may only shrink, and **must be empty at the M2.1 review cut** (each entry has its own fix checkbox right after this item)
- [x] `write-tests` skill: assert concrete outcomes (`data-asset-id`, `src`, the asset in each frame), not just counts. Rewrite the PR #45 swap and move assertions
- **Done when:** PR e2e runs with no retries anywhere, the CI report shows the `@flaky` count (0, or each entry has a next checkbox), and the swap / move specs check the asset in each frame.
- **Size:** ~500 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #50 item 5

## Done note

zero Playwright CI retries; empty e2e/flaky.json + e2e-flaky job; swap/move data-asset-id asserts; write-tests skill
