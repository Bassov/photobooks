# codecov-patch-gate

Tag: prep
Milestone: M2.1
Title: blocking patch and no-drop project coverage (issue #72 A)
Status: done

## Scope

- [x] `codecov.yml`: `patch.default` `target: 85%`, `threshold: 0%`, not `informational`. (`project.default` / `project.floor` and expanded Components keys remain in YAML — valid, harmless)
- [ ] Moved to backlog: `docs/backlog/codecov-project-components.md` (owner decision 2026-10-18) — codecov/project status
- [ ] Moved to backlog: `docs/backlog/codecov-project-components.md` (owner decision 2026-10-18) — components table
- [x] The patch target counts every uploaded flag (unit now, `e2e` once `e2e-coverage-flag` lands; owner decision: e2e lines count toward `codecov/patch`). No informational unit-only status replaces the blocking one
- [x] Owner setup (recorded in `INTRO.md`, not an agent step): add `codecov/patch` to the required checks on `main`
- [x] `ci-gates` spec delta "Coverage thresholds and Codecov": blocking patch 85% (final; no planned raise) and the e2e flag rule; project/components noted as moved to backlog
- [ ] Moved to `exclusions-registry`: un-counting `test-fake` modules (needs the registry check)
- **Done when:** blocking `codecov/patch` at 85% is proven red on a scratch PR (#105) and green on a covered PR (#104).
- Narrowed by owner decision 2026-10-18 (Codecov does not post codecov/project or the components table on this repo)
- **Size:** ~150 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #72 A

## Done note

Owner-approved narrowing 2026-10-18: Done-when is blocking codecov/patch at 85% (red #105, green #104). Project no-drop status and components table moved to docs/backlog/codecov-project-components.md (Codecov does not post them on this repo). YAML project.* and Components keys retained as valid/harmless. INTRO requires only codecov/patch.
