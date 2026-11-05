## Decisions

1. **Where.** The rig hook runs `pnpm check:integrity && pnpm check:fast`; `check:fast` takes its unit argv from `quality/gates.json` `checks.fast`, which becomes `node scripts/unit-changed.mjs`. CI skips that step (`--skip-unit`) and runs `test:coverage`; `checks.core` stays full.
2. **Scoped run.** `vitest run --changed $(git merge-base HEAD origin/main) --passWithNoTests --coverage`, global thresholds 0; `UNIT_CHANGED_BASE` replaces `origin/main`. No merge-base → full run with thresholds. Both set `FC_NUM_RUNS=25` when unset.
3. **numRuns.** The 29 tests reading `FC_NUM_RUNS` get 25 from the env. `vitest.setup.mjs` adds `fc.configureGlobal({ numRuns })` for tests with no explicit `numRuns` (default 100), only when `FC_NUM_RUNS` is set and `CI` is not. Explicit per-test `numRuns` and `Math.max(1000, …)` floors win. CI and local `stryker:diff` (no `FC_NUM_RUNS`) are unchanged.
4. **Lint cache.** Under load `eslint .` (154 s) outlasts the scoped unit step (20 s); `lint` gets `--cache --cache-strategy content` in `.cache/eslint/` (warm 5 s). CI starts without a cache.
5. **RULES.md:** a push failure outside the diff goes in the PR body; one retry with the scoped run.

## Touch-set & Test Plan

| Path                            | Reason                                       |
| ------------------------------- | -------------------------------------------- |
| `quality/gates.json`            | gate config: `checks.fast` unit → scoped run |
| `scripts/unit-changed.mjs`      | merge-base + `--changed` wrapper             |
| `scripts/unit-changed.test.mjs` | unit tests (injected spawn)                  |
| `scripts/vitest.setup.mjs`      | local `fc.configureGlobal`                   |
| `package.json`                  | gate config: `lint` cache                    |
| `docs/roadmap/RULES.md`         | push-stop rule                               |
| `AGENTS.md`                     | `check:fast` row                             |

- Tests: argv (base / none), `FC_NUM_RUNS` default and keep, exit passthrough, `localFcNumRuns`. No PBT / e2e.
