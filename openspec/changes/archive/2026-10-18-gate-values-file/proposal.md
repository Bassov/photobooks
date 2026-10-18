# Proposal

## Why

Gate thresholds are scattered across Vitest, Stryker, LHCI, `budget.json`, Playwright, burn-in default, and `e2e/flaky.json`, so reviewers cannot see or ratchet them in one place. M2.1’s review cut needs a single data file before weakening guards land.

## What Changes

- **In:** Add `quality/gates.json` as the sole home for every gate value except Codecov: Vitest coverage floors, Stryker nightly thresholds, LHCI assertion level / run count, `budget.json` resource limits, Playwright CI retries (main + `@flaky` project), default burn-in repeat count, and the `@flaky` list.
- **In:** Point `vite.config.ts`, Stryker config (JSON or `.mjs` wrapper), `lighthouserc.cjs`, and `playwright.config.ts` (plus burn-in / flaky loaders) at that file — no hardcoded thresholds in those configs.
- **In:** A static check in `pnpm check` (no config evaluation) that those consumers take values from `quality/gates.json` and hardcode none.
- **Out:** `codecov.yml` (other PR); gate-weakening AST / ratchet logic; value changes (no weaker, dropped, or optional gates); `openspec/config.yaml` / `.cursor/agents`; `src/editor/session/` / `src/editor/projectSession.ts`; new dependencies.

## Capabilities

### New Capabilities

- (none)

### Modified Capabilities

- `ci-gates`: Gate numeric/list thresholds live in `quality/gates.json`; listed tool configs read them; static check enforces no hardcoded duplicates; behavior and thresholds stay identical to main.

## Success criteria

- Every in-scope gate value except Codecov lives only in `quality/gates.json` (same numbers/lists as main today).
- Consumers above read from that file; static check fails on hardcoded gate values.
- CI on this PR’s head behaves exactly as before (same thresholds in CI logs/results).

## Risks

- Mis-wiring a reader could silently drop or weaken a threshold → static check + CI head proof; no value may change.
- Dual copies (`budget.json` / `e2e/flaky.json`) if kept as mirrors → must stay byte-equal to gates or be derived at read time, never independently edited.
