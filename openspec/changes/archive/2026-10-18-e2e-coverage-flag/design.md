# Design

## Context

See proposal.md — Why. Blocking `codecov/patch` already merges uploaded flags; only `unit` uploads today. This change adds the `e2e` flag from Playwright Istanbul coverage without weakening any gate and without moving required checks between jobs.

## Goals / Non-Goals

**Goals:** Instrument Playwright’s preview build only; collect/merge/upload e2e lcov as Codecov flag `e2e`; wait for unit+e2e before notify; keep Stryker on Vitest so e2e-only lines stay NoCoverage; prove Done-when on this PR’s CI head.

**Non-Goals:** Changing `quality/gates.json` floors; instrumenting production/preview/LHCI; counting workers in e2e; local-only Done-when claims; editing `openspec/config.yaml`, `.cursor/*`, `AGENTS.md`, `scripts/agent.mjs`.

## Decisions

1. **Gate plugin on `VITE_COVERAGE=1` ourselves** — Include `vite-plugin-istanbul` only when `process.env.VITE_COVERAGE === '1'` (item literal). Do not rely on the plugin’s `requireEnv`/`true` string. Set `forceBuildInstrument: true` so `pnpm build` (Playwright `webServer`) is instrumented. Sourcemaps on for that build so reports map to `src/**`.
2. **One shared exclude list** — Export the Vitest coverage exclude globs from `vite.config.ts` (or a tiny sibling module both Vitest and Istanbul read) so e2e instrumentation cannot drift. Additionally exclude `*.worker.ts` for Istanbul only (workers stay in the unit denominator; e2e must not count them).
3. **Shared fixture, every spec imports `test` from it** — `e2e/fixtures/coverage.ts` extends Playwright `test` with an auto fixture that dumps `window.__coverage__` after each test into `.nyc_output/`; specs switch imports from `@playwright/test` to that module (re-export `expect`). `scripts/merge-e2e-coverage.mjs` runs `nyc` → `coverage-e2e/lcov.info`.
4. **Playwright `webServer` is the only setter of `VITE_COVERAGE=1`** — when `E2E_COVERAGE=1`, command is `VITE_COVERAGE=1 VITE_E2E=1 pnpm build && … preview`. Never set on production/preview/LHCI builds.
5. **Two-phase integration e2e (LoAF vs Istanbul)** — Istanbul trips LoAF frame-budget asserts. CI: (a) uninstrumented full suite (required gate); (b) `E2E_COVERAGE=1` harvest with `--grep-invert "frame-budget gates"`; (c) merge + Codecov `flags: e2e` + `fail_ci_if_error`. Specs always import the coverage fixture. `codecov.yml`: `flags.e2e` carryforward, `notify.after_n_builds: 2`. Blocking `patch.default` unchanged.
6. **Exact-pinned deps** — `vite-plugin-istanbul@9.0.1`, `nyc@18.0.0` (versions confirmed at design time).
7. **Mutation unchanged** — No Stryker config change that adds Playwright; NoCoverage still means no unit coverage.
8. **Ignore artifacts** — `.gitignore` adds `coverage-e2e/` and `.nyc_output/` (`coverage` alone does not match those names).

## Security

New exact-pinned devDependencies (`vite-plugin-istanbul`, `nyc`) expand the supply chain. Before archive: `pnpm audit:ci` green and Cursor Security Review pass. Dependabot and dependency-review stay in force. Instrumentation is off unless `VITE_COVERAGE=1`; production, preview, and LHCI builds remain uninstrumented (no coverage payload in shipped assets).

## Risks / Trade-offs

- Instrumented e2e build slower / larger → acceptable; non-e2e builds stay clean.
- `after_n_builds: 2` → if one upload fails, integration/`fail_ci_if_error` must fail loudly, not leave patch pending silently.

## Touch-set

| Path                                                      | Reason                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------- |
| `package.json`, `pnpm-lock.yaml`                          | Exact-pinned `vite-plugin-istanbul`, `nyc`                                |
| `vite.config.ts`                                          | Shared excludes; conditional Istanbul + sourcemaps when `VITE_COVERAGE=1` |
| `playwright.config.ts`                                    | `webServer` sets `VITE_COVERAGE=1`                                        |
| `e2e/fixtures/coverage.ts`                                | Shared coverage fixture                                                   |
| `e2e/**/*.spec.ts` (incl. burn-in specs importing `test`) | Import fixture `test`/`expect`                                            |
| `scripts/merge-e2e-coverage.mjs`                          | `nyc` merge → `coverage-e2e/lcov.info`                                    |
| `.gitignore`                                              | Ignore `coverage-e2e/`, `.nyc_output/`                                    |
| `.github/workflows/integration.yml`                       | Merge + Codecov upload `flags: e2e`                                       |
| `codecov.yml`                                             | `flags.e2e`, `notify.after_n_builds: 2`                                   |
| `README.md`                                               | One-line CI note: Codecov `unit` + `e2e` flags                            |
| `openspec/specs/ci-gates/spec.md` (via delta)             | Spec SoT for e2e flag + mutation unit-only                                |
| `openspec/changes/e2e-coverage-flag/**`                   | Planning artifacts                                                        |
| `docs/roadmap/M2.1/e2e-coverage-flag.md`                  | Scope ticks / Status via roadmap CLI                                      |

## Migration

Ship on `feat/e2e-coverage-flag`. After merge, Codecov merges flags for `codecov/patch`. Rollback: revert instrumentation + upload (would drop e2e from patch — avoid unless emergency).

## Open Questions

None — Done-when proof is this PR’s CI Codecov comment + integration/stryker-diff behavior on head.
