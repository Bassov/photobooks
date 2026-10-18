# Design

## Context

See proposal.md. Today thresholds are hardcoded in `vite.config.ts` (coverage 80), `stryker.config.json` (80/60/60), `lighthouserc.cjs` (`numberOfRuns: 1`, `performance-budget: error`), `budget.json`, `playwright.config.ts` (`retries: 0`, flaky `retries: 2`), `scripts/e2e-burn-in-count.mjs` (default 10), `e2e/flaky.json` (`[]`), and workflow `E2E_BURN_IN: '10'`. `codecov.yml` stays untouched.

## Goals / Non-Goals

**Goals:** One SoT `quality/gates.json` with those exact values; listed configs/loaders read it; static check in `pnpm check`; mirrors stay equal; CI thresholds unchanged.

**Non-Goals:** Value ratchet/weakening guards (later `gate-ratchet`); Codecov; editor session files; new deps; `openspec/config.yaml` / `.cursor/agents`.

## Decisions

1. **`quality/gates.json` shape** — keys: `coverage` (statements/branches/functions/lines), `stryker.thresholds` (high/low/break), `lighthouse` (`numberOfRuns`, `assertions`, `budgets` = current `budget.json` array), `playwright` (`retries`, `flakyRetries`), `e2e` (`burnInDefault`, `flakySpecs`). Values copy main exactly (this PR must not weaken any copied value).
   - Rejected: splitting per-tool files (item asks one file).

2. **Readers** — shared `scripts/load-gates.mjs` (`validateGates` + `loadGates`). Every runtime consumer imports it: `vite.config.ts`, `playwright.config.ts`, `stryker.config.mjs`, `lighthouserc.mjs` (replaces `.cjs`), burn-in, flaky-list. Delete `stryker.config.json` after `stryker.config.mjs` lands — only `.mjs` + `quality/gates.json` remain authoritative for Stryker. Mutate globs move verbatim into `.mjs`; thresholds from gates. `lighthouserc.mjs` keeps `budgetsPath: './budget.json'`. Playwright retries and flaky list come only from gates. Burn-in default when `E2E_BURN_IN` unset/empty = `gates.e2e.burnInDefault`.
   - Rejected: evaluating Vite/Stryker inside the static check; keeping JSON alongside `.mjs`; dual flaky parsers; raw `JSON.parse` without `validateGates`; CJS loader duplicate (unmutatable via vitest).

3. **Mirrors** — keep committed `budget.json` and `e2e/flaky.json` as path-stable mirrors. Static check deep-equals them to `gates.lighthouse.budgets` and `gates.e2e.flakySpecs`. Workflow drops hardcoded `E2E_BURN_IN: '10'` so the script default (from gates) applies — same effective count.
   - Rejected: deleting mirrors (breaks LHCI path / existing docs); dual independent edits.

4. **Static check** — `scripts/check-gate-values.mjs` (+ unit tests): no spawning Vite/Stryker/LHCI/Playwright. (a) Parse gates + deep-equal mirrors. (b) Presence of `load-gates` / `quality/gates.json` in: `vite.config.ts`, `stryker.config.mjs`, `lighthouserc.mjs`, `playwright.config.ts`, `scripts/e2e-burn-in-count.mjs`, `scripts/e2e-flaky-list.mjs`, `scripts/load-gates.mjs`. (c) Absence of prior hardcoded gate literals (incl. unquoted `thresholds: { high: 80`). (d) Workflow absence of `E2E_BURN_IN: '<n>'`. Wire as `package.json` `gate-values` in `CORE_CHECKS`.
   - Public API under test: `loadGates` + check helpers; reuse vitest `.mjs` pattern from `mutation-scope.test.mjs`.

5. **Gate-config touch** — intentional moves only; every numeric/list threshold stays identical to main. Reason: single SoT for M2.1 ratchet prep.

## Touch-set

| Path                                                    | Reason                                                    |
| ------------------------------------------------------- | --------------------------------------------------------- |
| `quality/gates.json`                                    | new SoT for gate values                                   |
| `scripts/load-gates.mjs`                                | shared read/validate                                      |
| `scripts/load-gates.d.mts`                              | types for TS config imports                               |
| `tsconfig.node.json`                                    | include load-gates.d.mts                                  |
| `scripts/load-gates.test.mjs`                           | unit coverage for loader                                  |
| `lighthouserc.mjs`                                      | replaces `.cjs`; runs/assertions from gates (gate-config) |
| `lighthouserc.cjs`                                      | delete                                                    |
| `docs/lessons/08-new-production-files-under-src-are.md` | stryker.config path → `.mjs`                              |
| `docs/roadmap/M2.1/gate-ratchet.md`                     | path rename to `.mjs`                                     |
| `docs/roadmap/M2.1/exclusions-registry.md`              | path rename to `.mjs`                                     |
| `scripts/check-gate-values.mjs`                         | static no-hardcode + mirror equality                      |
| `scripts/check-gate-values.test.mjs`                    | unit coverage for static check                            |
| `scripts/check.mjs`                                     | inventory entry for gate-values check                     |
| `scripts/check.test.mjs`                                | expect `gate-values` in core inventory                    |
| `package.json`                                          | `gate-values` script; LHCI config → `lighthouserc.mjs`    |
| `knip.json`                                             | entry `lighthouserc.mjs!` after `.cjs` delete             |
| `eslint.config.js`                                      | ignore `lighthouserc.mjs` after rename                    |
| `vite.config.ts`                                        | coverage thresholds from gates (gate-config)              |
| `stryker.config.mjs`                                    | new Stryker entry; thresholds from gates (gate-config)    |
| `stryker.config.json`                                   | delete — no second SoT (gate-config)                      |
| `stryker.mutate.md`                                     | point exclude docs at `.mjs` (JSON wording obsolete)      |
| `scripts/mutation-scope.mjs`                            | default config path → `stryker.config.mjs`                |
| `scripts/check-mutation-scope.mjs`                      | messages/path for `.mjs`                                  |
| `budget.json`                                           | mirror of `gates.lighthouse.budgets` (gate-config)        |
| `playwright.config.ts`                                  | retries + flaky list from gates (gate-config)             |
| `e2e/flaky.json`                                        | mirror of `gates.e2e.flakySpecs`                          |
| `scripts/e2e-burn-in-count.mjs`                         | default from gates                                        |
| `scripts/e2e-burn-in-count.test.mjs`                    | default-from-gates cases                                  |
| `scripts/e2e-flaky-list.mjs`                            | load list from gates                                      |
| `scripts/e2e-flaky-list.test.mjs`                       | gates-backed load cases                                   |
| `.github/workflows/integration.yml`                     | drop hardcoded `E2E_BURN_IN: '10'` (gate-config)          |
| `docs/roadmap/M2.1/gate-values-file.md`                 | tick scope                                                |
| `openspec/changes/gate-values-file/**`                  | planning artifacts                                        |

## Risks / Trade-offs

- [Missed hardcoded literal] → static check + CI head proof of same thresholds.
- [Stryker path break] → delete JSON; update mutation-scope, package scripts, `stryker.mutate.md` in one PR.
- [Mirror drift] → check fails loudly on inequality (exact condition), no silent keep-both.

## Migration

Land file + readers + check together; delete `stryker.config.json` in the same commit set. No value migration beyond copy. Rollback = restore hardcoded literals (forbidden by quality bar once merged).

## Open Questions

N/A
