# codecov-validate-timeout

Tag: contingency
Milestone: M2.1
Title: AbortSignal.timeout for Codecov YAML validate fetch

## Scope

- [ ] `validateCodecovYml` aborts hung `api.codecov.io/validate` within ~2.5s and treats Abort/Timeout as network fallback
- [ ] Unit tests mock fetch (no live API); keep patch coverage ≥85 for touched script lines
- **Done when:** hung validate cannot trip Vitest 5s timeout; `pnpm check` patch-coverage green
- **Size:** ~80 lines
- **Source:** CI run 39250896481
