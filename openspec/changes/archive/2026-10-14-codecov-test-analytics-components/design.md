# Design

## Context

See proposal.md. Coverage already uploads via `codecov/codecov-action@v7` with `flags: unit`. Vitest coverage reporters are `text` / `lcov` / `json-summary` — no JUnit. `codecov.yml` has flags/carryforward/comment but no `component_management`.

## Goals / Non-Goals

**Goals:**

- Emit JUnit from the same Vitest run as coverage; upload via Codecov test-results action
- Define path Components for `photo` / `perf` / `lib` and show them in the Codecov PR comment
- Keep coverage floors, sticky coverage comment, and patch-informational status unchanged

**Non-Goals:**

- Bundle Analysis; hard patch gate; e2e JUnit/coverage flags; removing sticky coverage comment

## Decisions

1. **JUnit via Vitest reporters in `vite.config.ts`** — add `junit` alongside default; write `reports/vitest-junit.xml` (under gitignored `reports/`). Shared by local `pnpm test` / `test:coverage` and CI; local writes are intentional and ignored. Prefer config over CLI flags to avoid CI/local drift.

2. **Upload with `codecov/codecov-action@v7` + `report_type: test_results`** — preferred over deprecated `test-results-action`. Place the step **immediately after** “Unit and property tests”, **before** Coverage summary / sticky comment / Build. Condition: `if: ${{ !cancelled() && hashFiles('reports/vitest-junit.xml') != '' }}` (policy A). Pass `files: reports/vitest-junit.xml` and `flags: unit` (same flag as coverage upload for Test Analytics filtering); reuse `CODECOV_TOKEN`; `fail_ci_if_error: ${{ secrets.CODECOV_TOKEN != '' }}` only when the file exists (step skipped otherwise). Do **not** copy coverage upload’s `if: always()` — coverage stays where it is today (after Build/audit).

3. **Components only in YAML** — `component_management.individual_components` for `photo`, `perf`, `lib` with `src/photo/**`, `src/perf/**`, `src/lib/**`. No per-component failing statuses yet. Extend `comment.layout` to include `components` (keep `reach,diff,flags,files`).

4. **Composition boundary** — CI/config only; no product module changes. No new npm dependencies (Vitest ships junit reporter; Actions are workflow pins).

## Touch-set

- `vite.config.ts` — reporters + JUnit `outputFile`
- `.github/workflows/checks.yml` — test-results upload step (after unit tests)
- `codecov.yml` — `component_management` + comment layout
- `openspec/specs/ci-gates/spec.md` — sync on archive

## Risks / Trade-offs

- [Reporter misconfig → no JUnit file] → step skipped via `hashFiles`; CI stays green; fix shows up as missing Test Analytics in Codecov UI/logs
- [PR comment clutter] → Components add one table; sticky coverage stays; revisit later if noisy
- [Component status fail spam] → omit component statuses initially (PR comment + UI filter only)

## Security

Reuses existing `CODECOV_TOKEN`; no new secrets. Do not log token. Actions remain pinned to major versions already used in-repo style (`@v5` / `@v7`).

## Migration Plan

Land on a PR; verify Codecov comment shows Components and Test Analytics after a green run. Rollback = revert the three config files.
