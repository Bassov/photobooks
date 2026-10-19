# Proposal

## Why

Gate/agent scripts are still hand-listed in Vitest coverage `include`, Stryker `mutate`, and Codecov `flags.unit.paths`. New scripts miss coverage and mutation until someone edits three configs. PR #81 already proved script-level mutation; M2.1 needs the default to be glob-based.

## What Changes

- Replace hand-lists with `scripts/**/*.mjs`, minus `scripts/**/*.test.mjs` and ≤10-line delegating CLI entries (e.g. `scripts/agent-cli.mjs`).
- Extend `check-mutation-scope` so an unclassified production script fails `verify:fast`.
- Bring existing gate scripts into the nightly mutate set; diff gate applies on change. Scripts that cannot meet the bar when first touched get roadmap growth for tests — never a product exclude.
- Teach `pr-policy` that removing `scripts/**` / `scripts/**/*.mjs` from coverage `include` fails, and that glob subsumption + paired script test/CLI excludes are not weakening.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `ci-gates`: scripts enter coverage/mutation by default; mutation-scope covers `scripts/`; pr-policy treats script glob include/excludes correctly.

## Impact

- Config: `vite.config.ts`, `stryker.config.mjs`, `stryker.mutate.md`, `codecov.yml`
- Scripts: `check-mutation-scope.mjs`, `mutation-scope.mjs` (if shared helpers), `check-gate-ratchet.mjs` (+ tests)
- Named gate scripts enter mutate via glob; add tests only where this PR first touches them or coverage/mutation would fail
- Out: `scripts/agent.mjs` body (other session); app `src/**`; no package.json / lockfile deps
- Success: new `scripts/foo.mjs` covered + in `stryker:diff` with no config edit; unclassified script fails `verify:fast`; removing `scripts/**` from include fails pr-policy (observed)
- Risks: coverage dilution from newly included untested scripts (stay ≥ floors); `pull_request_target` pr-policy still runs base script until merge (HEAD `pnpm check` owns the new rules)
