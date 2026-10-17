# e2e-burn-in

Tag: prep
Milestone: M2.1
Title: new and changed e2e specs are burned in on every PR

## Scope

- [ ] `integration` gains a `burn-in` step: tests in added or changed `e2e/**/*.spec.ts` files, and specs that import changed `e2e/helpers/**`, run `--repeat-each=10 --retries=0 --workers=1`. An item file can declare `Burn-in: 50` (flake-fix items)
- [ ] The CI report shows the burn-in count and the retried-pass ("flaky") count of the main run from the Playwright JSON reporter, before `strict-e2e` removes retries
- [ ] Repeat count as `E2E_BURN_IN` in `integration.yml` for now; `gate-values-file` moves it into `quality/gates.json` and the ratchet guards it
- **Done when:** a deliberately timing-dependent test fails `burn-in`, a `Burn-in: 50` item runs its specs 50 times in CI, and the CI report lists flaky retries of the main run.
- **Size:** ~300 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** PR #82 review §3; #50 item 5
