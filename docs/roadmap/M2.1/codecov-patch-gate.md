# codecov-patch-gate

Tag: prep
Milestone: M2.1
Title: blocking patch and no-drop project coverage (issue #72 A)

## Scope

- [ ] `codecov.yml`: `patch.default` `target: 85%`, `threshold: 0%`, not `informational`. `project.default` `target: auto`, `threshold: 0.5%`, plus a `project.floor` status at the current 80% so no value gets weaker
- [ ] `component_management`: add `editor` (`src/editor/**`), `project` (`src/project/**`), `assets` (`src/assets/**`), `render` (`src/render/**`), `core` (`src/core/**`) and `scripts` (`scripts/**`) next to `photo` / `perf` / `lib`
- [ ] The patch target counts every uploaded flag (unit now, `e2e` once `e2e-coverage-flag` lands; owner decision: e2e lines count toward `codecov/patch`). No informational unit-only status replaces the blocking one
- [ ] Owner setup (recorded in `INTRO.md`, not an agent step): add `codecov/patch` and `codecov/project` to the required checks on `main`
- [ ] `ci-gates` spec delta "Coverage thresholds and Codecov": targets (85, final; no planned raise), components and the e2e flag rule
- [ ] Moved to `exclusions-registry`: un-counting `test-fake` modules (needs the registry check)
- **Done when:** a PR with patch coverage under 85% gets a red `codecov/patch`, a PR that drops project coverage by more than 0.5% gets a red `codecov/project`, and the Codecov comment shows the `editor`, `project`, `assets` and `scripts` components.
- **Size:** ~150 changed lines (target ~1000, max 1500 incl. tests)
- **Source:** #72 A
