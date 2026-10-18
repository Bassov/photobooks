# burn-in-targets-cli-spawn-assert

Tag: contingency
Milestone: M2.1
Title: Burn-in targets spawn test must not assume burn-in-smoke in every PR diff

## Scope

- [x] Replace or harden `spawned CLI prints targets from injected-equivalent git base` so it does not require `e2e/burn-in-smoke.spec.ts` in the live `origin/main` diff (fails on clean main and every unrelated PR)
- **Done when:** `pnpm exec vitest run scripts/e2e-burn-in-targets.test.mjs` is green on a clean tree matching `origin/main` and on a branch that only touches unrelated e2e specs

## Done note

fixed inline in narrow-add-spread-horizontal-contain (spawn CLI assert no longer requires burn-in-smoke in every live origin/main diff)
