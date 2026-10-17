# codecov-patch-gate

Tag: prep
Milestone: M2.1
Title: blocking patch and no-drop project coverage (issue #72 A)

## Scope

- [ ] `codecov.yml`: `patch.default` `target: 85%`, `threshold: 0%`, not `informational`. `project.default` `target: auto`, `threshold: 0.5%`, plus a `project.floor` status at the current 80% so no value gets weaker
- [ ] `component_management`: add `editor` (`src/editor/**`), `project` (`src/project/**`), `assets` (`src/assets/**`), `render` (`src/render/**`) and `core` (`src/core/**`) next to `photo` / `perf` / `lib`
- [ ] In-repo fakes that pass the `test-fake` check (no production importer) become coverage entries so they stop padding the total. Fakes that production imports stay counted, and the `ci-gates` spec says so
- [ ] `ci-gates` spec delta "Coverage thresholds and Codecov": the targets, the components and the planned raise in `gates-raise-90`
- **Done when:** a PR with patch coverage under 85% gets a red `codecov/patch`, a PR that drops project coverage by more than 0.5% gets a red `codecov/project`, and the Codecov comment shows the `editor`, `project` and `assets` components.
