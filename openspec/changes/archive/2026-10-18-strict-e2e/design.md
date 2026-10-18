# Design

## Context

See proposal.md. Today: `playwright.config.ts` sets `retries: isCi ? 2 : 0` and `trace: 'on-first-retry'`; several e2e describes still use `retries: 2`. CI report already shows main-run retried-pass count; there is no `e2e/flaky.json` or `@flaky` job. Swap asserts already use `data-asset-id`; move still relies on counts/status. `gate-values-file` later owns moving the list into `quality/gates.json`.

## Goals / Non-Goals

**Goals:**

- Zero retries on main PR/push e2e; strip all per-spec overrides; `retain-on-failure` traces.
- `e2e/flaky.json` + optional `@flaky` job under `integration`; report `@flaky` list length.
- Skill + swap/move asserts for concrete asset-in-frame outcomes.

**Non-Goals:**

- `quality/gates.json` / ratchet; editing `openspec/config.yaml` or `.cursor/agents`.
- Product LoAF fixes beyond relocating proven leftovers into `@flaky` + `pnpm roadmap add --after`.
- New dependencies.

## Decisions

1. **Global retries → 0; delete every `test.describe.configure({ retries })`** (including nested `retries: 0` that become redundant). Prefer empty `e2e/flaky.json`. If a whole spec file still flakes under zero retries, list that **spec path** in `flaky.json`, run it only via project `flaky`, and add a fix item via `pnpm roadmap add --after strict-e2e` (file granularity is intentional — no per-title entries).
   - Rejected: keep parent `retries: 2` for “CPU-sensitive” suites.

2. **`@flaky` contract** — `e2e/flaky.json` is a JSON array of repo-relative spec paths. `scripts/e2e-flaky-list.mjs` is the scripts SoT (burn-in exclude, CI resolve, report). `playwright.config.ts` inlines the same parse/validate (tsconfig.node cannot type-import repo `.mjs` without widening includes). Default project `testIgnore` adds those paths; project `flaky` selects them with `retries: 2`. CI: `e2e-flaky-resolve` always reads the list (`integration` requires its success); `e2e-flaky` has job-level `if: has_targets == true`. Empty list → `e2e-flaky` skipped (`success|skipped` OK). Burn-in targets exclude flaky paths.
   - Rejected: title-substring greps; CI-only filter; main-suite retries for listed tests; moving `@flaky` outside `integration`; leaving flaky paths in burn-in; success-no-op instead of job skip; ignoring resolve failures.

3. **CI report** — extend `formatE2eSectionMarkdown` with `| @flaky list | N |` from `e2e/flaky.json` length (always, including 0). Keep existing retried-pass row (should be 0 on main).

4. **Assertions** — after keyboard move in `e2e/drag-swap.spec.ts`, assert source/target `data-asset-id` on the same `button[data-filled]` / frame locators already used for swap. Reuse existing imports (`openSessionEditor`, `photoFixturePaths`, `assertDocumentFitsViewport`); no new helper unless duplication appears. Update `.cursor/skills/write-tests/SKILL.md` E2E section accordingly.

5. **Gate-config touch** — `playwright.config.ts` (retries ↓, `retain-on-failure`, `testIgnore` + project `flaky`) and `.github/workflows/integration.yml` (`e2e-flaky` + `integration` needs) are intentional stricter edits. Reason: M2.1 zero-retry ratchet.

## Touch-set

| Path                                      | Reason                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ |
| `playwright.config.ts`                    | retries → 0; `trace: retain-on-failure`; `testIgnore` + project `flaky` (stricter CI gate) |
| `e2e/flaky.json`                          | new flaky allowlist (empty preferred)                                                      |
| `scripts/e2e-burn-in-targets.mjs`         | exclude `e2e/flaky.json` paths from burn-in                                                |
| `scripts/e2e-burn-in-targets.test.mjs`    | unit coverage for flaky exclude                                                            |
| `scripts/e2e-changed-quiet.test.mjs`      | assert `--project=chromium --workers=1`                                                    |
| `e2e/drag-swap.spec.ts`                   | remove retries; tighten move asserts                                                       |
| `e2e/drag-place.spec.ts`                  | remove retries overrides                                                                   |
| `e2e/filmstrip.spec.ts`                   | remove retries overrides                                                                   |
| `e2e/spread-view.spec.ts`                 | remove retries overrides                                                                   |
| `.github/workflows/integration.yml`       | `@flaky` job + `integration` needs (stricter gate graph)                                   |
| `scripts/e2e-flaky-list.mjs`              | load/validate/exclude flaky paths (scripts SoT)                                            |
| `scripts/e2e-flaky-list.test.mjs`         | unit coverage for flaky list helper                                                        |
| `scripts/e2e-playwright-summary.mjs`      | report `@flaky` list length                                                                |
| `scripts/e2e-playwright-summary.test.mjs` | unit coverage for the report row                                                           |
| `scripts/e2e-changed-quiet.mjs`           | main suite uses `--project=chromium`                                                       |
| `package.json`                            | `test:e2e` / `test:e2e:flaky` project pins                                                 |
| `.cursor/skills/write-tests/SKILL.md`     | concrete e2e outcome rule                                                                  |
| `openspec/changes/strict-e2e/**`          | planning artifacts                                                                         |
| `docs/roadmap/M2.1/strict-e2e.md`         | tick scope; follow-ups via `roadmap add` if needed                                         |

## Risks / Trade-offs

- [Surfaced flakes] → `@flaky` + follow-up item; never skip/loosening.
- [Job graph complexity] → empty list skips `@flaky`; `integration` still requires main e2e + burn-in.
- [src identity flake on tier upgrade] → prefer `data-asset-id`; use `src` only when already stable in that test.

## Migration

Land empty list first when possible. Non-empty list must ship with matching `roadmap add` checkboxes in the same PR. No rollback beyond restoring retries (forbidden by quality bar).
