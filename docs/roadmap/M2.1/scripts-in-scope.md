# scripts-in-scope

Tag: prep
Milestone: M2.1
Title: gate and agent scripts are in coverage and mutation by default (PR #81 pattern)
Status: done

## Scope

- [x] Coverage `include`, Stryker `mutate` and Codecov `flags.unit.paths` use `scripts/**/*.mjs` minus `scripts/**/*.test.mjs` and a ≤10-line delegating CLI entry list (`scripts/agent-cli.mjs`), instead of hand-listed files
- [x] `scripts/check-mutation-scope.mjs` also classifies `scripts/`: an unclassified script fails `verify:fast`
- [x] Existing gate scripts (`ci-report-comment.mjs`, `stryker-diff.mjs`, `mutation-scope.mjs`, `check-mutation-scope.mjs`, `*-summary.mjs`, `with-playwright-env.mjs`, `bootstrap-playwright-libs.mjs`) enter the nightly set; the diff gate applies when they change. A script that cannot reach the bar when first touched goes through the growth rule (the next checkbox adds its tests), never an exclude
- **Done when:** a new `scripts/foo.mjs` is covered and mutated by `stryker:diff` without any config edit, an unclassified script fails `verify:fast`, and removing `scripts/**` from `include` fails `pr-policy`.
- **Size:** ~300 + tests changed lines (target ~1000, max 1500 incl. tests)
- **Source:** PR #81 F1

## Done note

scripts/**/*.mjs coverage/mutate + scripts/ Codecov unit paths; check-mutation-scope classifies scripts/; pr-policy subsumption + paired thin-CLI excludes; stryker:diff 85.16% 0 NoCoverage
